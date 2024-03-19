import { useState } from "react";
import "./App.css";

export default function App() {
  const [result, setResult] = useState<string | undefined>();
  const [question, setQuestion] = useState<string | undefined>();
  const [file, setFile] = useState<File | undefined>();
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>();

  const handleQuestionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(event.target.value);
  };

  const handleSemanticSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSemanticSearch(event.target.checked);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      const acceptedFileTypes = [".pdf", ".txt", ".csv", ".docx"];
      const fileExtension = selectedFile.name.split(".").pop();
      
      if (!acceptedFileTypes.includes(`.${fileExtension}`)) {
        setUploadError("Invalid file type. Please select a PDF, TXT, CSV, or DOCX file.");
        setFile(undefined); // Clear the file input
      } else {
        setFile(selectedFile);
        setUploadError(undefined); // Reset upload error when a valid file is selected
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      console.error("Error: File is required.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Uploaded file:", data.filename);
      setUploadSuccess(true);
    } catch (error) {
      console.error("Error", error);
      setUploadError("Error uploading file. Please try again."); // Set upload error if fetch fails
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file || !question) {
      console.error("Error: File and question are required.");
      return;
    }
    setUploadSuccess(false); 
    const formData = new FormData();
    formData.append("input_query", question);
    formData.append("semantic_search", String(semanticSearch));

    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResult(data.result);
    } catch (error) {
      console.error("Error", error);
    }
  };

  return (
    <div>
    <h1 className="heading">Document Reader</h1> 
    <div className="appBlock">
      {uploadSuccess && <div className="notification">Upload successful!</div>}
      {uploadError && <div className="error-popup">{uploadError}</div>} {/* Render upload error as pop-up */}
      <div className="uploadSection">
        <label className="fileLabel" htmlFor="file">
          Upload a file:
        </label>

        <input
          type="file"
          id="file"
          name="file"
          accept=".pdf,.txt,.csv,.docx"
          onChange={handleFileChange}
          className="fileInput"
        />
        <br />
        <button
          className="uploadBtn"
          type="button"
          onClick={handleUpload}
          disabled={!file}
        >
          Upload
        </button>
      </div>

      <div className="chatSection">
        <form onSubmit={handleSubmit} className="form">
          <label className="questionLabel" htmlFor="question">
            Question:
          </label>
          <input
            className="questionInput"
            id="question"
            type="text"
            value={question || ""}
            onChange={handleQuestionChange}
            placeholder="Ask your question here"
          />

          <br />
          <label>
            <input
              type="checkbox"
              checked={semanticSearch}
              onChange={handleSemanticSearchChange}
            />
            Semantic Search
          </label>
          <br />
          <button
            className="submitBtn"
            type="submit"
            disabled={!file || !question}
          >
            Submit
          </button>
        </form>
        <br />
        <p className="resultOutput">Result: {result}</p>
      </div>
    </div>
    </div>
  );
}
