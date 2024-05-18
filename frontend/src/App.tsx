import { useState } from "react";
import "./App.css";

export default function App() {
  const [result, setResult] = useState<string | undefined>();
  const [question, setQuestion] = useState<string | undefined>();
  const [file, setFile] = useState<File | undefined>();
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false); // State variable for loading
  const [videoLink, setVideoLink] = useState<string>('');
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);


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
      setLoading(true); // Set loading to true when starting upload
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Uploaded file:", data.filename);
      setUploadSuccess(true);
      setLoading(false); // Set loading to false when upload is complete
    } catch (error) {
      console.error("Error", error);
      setUploadError("Error uploading file. Please try again."); // Set upload error if fetch fails
      setLoading(false); // Set loading to false on error
    }
  };

  const handleVideoLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoLink(e.target.value);
  };

  const handleVideoUpload = async () => {
    if (!videoLink) {
      console.error("Error: Video link is required.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/transcribe_video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoLink }),
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Transcription Result:", data);

      // Update state to display transcription result
      setResult(data.map((chunk: Record<string, any>) => chunk.text).join('\n'))

      setUploadSuccess(false);
      setUploadError(undefined);
    } catch (error) {
      console.error("Error", error);
      setUploadError("Error uploading video link. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file || !question) {
      console.error("Error: File and question are required.");
      return;
    }
    setUploadSuccess(false);
    setLoading(true); // Set loading to true when starting prediction
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
      setLoading(false); // Set loading to false when prediction is complete
    } catch (error) {
      console.error("Error", error);
      setLoading(false); // Set loading to false on error
    }
  };

  const closeWelcomePopup = () => {
    setShowWelcomePopup(false);
  };

  return (
    <div>
      <h1 className="heading">Pdf Tutor</h1>
      {showWelcomePopup && (
        <div className="welcomePopup">
          <div className="welcomeContent">
            <h1>Welcome🙏to Pdf Tutor</h1>
            <p>Upload your file or video link to get started</p>
            <button onClick={closeWelcomePopup} className="closePopupBtn">Close</button>
          </div>
        </div>
      )}
      <div className="appBlock">
        {uploadSuccess && <div className="notification">Upload successful!</div>}
        {uploadError && <div className="error-popup">{uploadError}</div>}
        <div className="container">
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
              disabled={!file || loading}
            >
              {loading ? "Uploading..." : "Upload"}
            </button>
            <br />
            <label className="fileLabel1" htmlFor="videoLink">
              Upload a video or YouTube link:
            </label>
            <input
              type="text"
              id="videoLink"
              name="videoLink"
              value={videoLink}
              onChange={handleVideoLinkChange}
              placeholder="Enter video URL"
              className="fileInput1"
            />
            <br />
            <button
              className="uploadBtn"
              type="button"
              onClick={handleVideoUpload}
              disabled={!videoLink || loading}
            >
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>

          <div className="chatSection">
            <div className="resultOutput">
              <span style={{ fontSize: '2rem' }}>🤖</span>
              {loading ? "Loading..." : result}
            </div>
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
                disabled={!file || !question || loading}
              >
                {loading ? "Loading..." : "Submit"}
              </button>
            </form>
            <br />
          </div>
        </div>
      </div>
    </div>
  );
}
