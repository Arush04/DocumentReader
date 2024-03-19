from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form
import shutil
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
import shutil
# import argparse
from llm.wrapper import setup_qa_chain
from llm.wrapper import query_embeddings
import box
import yaml
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import PyPDFLoader, DirectoryLoader
from langchain.embeddings import HuggingFaceEmbeddings

with open('config.yml', 'r', encoding='utf8') as ymlfile:
    cfg = box.Box(yaml.safe_load(ymlfile))

# Load environment variables from .env file (if any)
load_dotenv()

class Response(BaseModel):
    result: str | None

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

def run_ingest(uploaded_file_path: str):
    loader = DirectoryLoader(uploaded_file_path,
                             glob='*.pdf',
                             loader_cls=PyPDFLoader)

    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=cfg.CHUNK_SIZE,
                                                   chunk_overlap=cfg.CHUNK_OVERLAP)
    texts = text_splitter.split_documents(documents)

    embeddings = HuggingFaceEmbeddings(model_name=cfg.EMBEDDINGS,
                                       model_kwargs={'device': 'cpu'})

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
