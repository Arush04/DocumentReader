from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form
import shutil
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from llm.wrapper import setup_qa_chain
from llm.wrapper import query_embeddings
import box
import yaml
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.embeddings import HuggingFaceEmbeddings
import torch
from transformers import pipeline
from tempfile import NamedTemporaryFile
from typing import List
import timeit
import logging
from pydub import AudioSegment
from pytube import YouTube

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

with open('config.yml', 'r', encoding='utf8') as ymlfile:
    cfg = box.Box(yaml.safe_load(ymlfile))

# Load environment variables from .env file (if any)
load_dotenv()

class Response(BaseModel):
    result: str | None

logging.basicConfig(level=logging.INFO)

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:3000"
]

app = FastAPI()

UPLOAD_FOLDER = "data"
# Ensure the upload folder exists; create it if it doesn't
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionResponse(BaseModel):
    result: str

class VideoLink(BaseModel):
    videoLink: str


pipe = pipeline("automatic-speech-recognition", model="distil-whisper/distil-medium.en", device=device)

def download_audio_from_youtube(youtube_url):
    yt = YouTube(youtube_url)
    stream = yt.streams.filter(only_audio=True).first()
    output_path = stream.download()
    base, ext = os.path.splitext(output_path)
    audio_file = base + '.mp3'
    os.rename(output_path, audio_file)
    return audio_file

def transcribe_speech_from_youtube(youtube_url):
    audio_filepath = download_audio_from_youtube(youtube_url)

    # Convert to WAV format with 16kHz sample rate if necessary
    audio = AudioSegment.from_file(audio_filepath)
    audio = audio.set_frame_rate(16000).set_channels(1)
    audio.export("converted_audio.wav", format="wav")
    audio = AudioSegment.from_file("converted_audio.wav")

    # Split audio into 15-second chunks
    chunk_length_ms = 15000  # 15 seconds in milliseconds
    chunks = [audio[i:i + chunk_length_ms] for i in range(0, len(audio), chunk_length_ms)]

    aligned_chunks = []
    transcription_time_total = 0

    # Transcribe each chunk and measure time
    for chunk_id, chunk in enumerate(chunks):
        start_time = timeit.default_timer()
        chunk.export("temp_chunk.wav", format="wav")
        output = pipe("temp_chunk.wav")
        transcription_time = timeit.default_timer() - start_time
        transcription_time_total += transcription_time

        # Calculate start and end times in seconds
        start_time_sec = chunk_id * 15
        end_time_sec = start_time_sec + len(chunk) / 1000.0

        aligned_chunks.append({
            "chunk_id": chunk_id,
            "chunk_length": len(chunk) / 1000.0,
            "text": output["text"],
            "start_time": start_time_sec,
            "end_time": end_time_sec,
            "transcription_time": transcription_time
        })

    # Clean up temporary files
    if os.path.exists("temp_chunk.wav"):
        os.remove("temp_chunk.wav")
    if os.path.exists("converted_audio.wav"):
        os.remove("converted_audio.wav")
    if os.path.exists(audio_filepath):
        os.remove(audio_filepath)

    return aligned_chunks


def run_ingest(uploaded_file_path: str):
    loader = DirectoryLoader(uploaded_file_path,
                             glob='*.pdf',
                             loader_cls=PyPDFLoader)

    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=cfg.CHUNK_SIZE,
                                                   chunk_overlap=cfg.CHUNK_OVERLAP)
    texts = text_splitter.split_documents(documents)

    embeddings = HuggingFaceEmbeddings(model_name=cfg.EMBEDDINGS,
                                       model_kwargs={'device': device})

    vectorstore = FAISS.from_documents(texts, embeddings)
    vectorstore.save_local(cfg.DB_FAISS_PATH)

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Save the uploaded file to the specified folder
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Run the ingest function after the file has been saved
        run_ingest(file_path)
        
        return {"filename": file.filename}
    except Exception as e:
        return {"error": str(e)}

@app.post("/predict", response_model=PredictionResponse)
def predict(input_query: str = Form(...), semantic_search: bool = Form(...)):
    if semantic_search:
        semantic_search_result = query_embeddings(input_query)
        result = f'Semantic search: {semantic_search_result}'
    else:
        qa_chain = setup_qa_chain()
        response = qa_chain({'query': input_query})
        result = f'Answer: {response["result"]}'
    print(result)
    return PredictionResponse(result=result)

@app.post("/transcribe_video", response_model=List[Dict[str, Any]])
async def transcribe_video(video_link: VideoLink) -> List[dict]:
    try:
        youtube_url = video_link.videoLink
        aligned_chunks = transcribe_speech_from_youtube(youtube_url)
        logging.info(f"Transcription Result: {aligned_chunks}")
        print(aligned_chunks)
        return aligned_chunks
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        return [{"error": str(e)}]