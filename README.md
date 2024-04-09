# DocumentReader

Setting up the chatbot locally:
1) Download the model from huggingface (https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF), you can choose any model, I have chosen the `mistral-7b-instruct-v0.1.Q4_K_M.gguf` because of my machine.
2) Make `models` folder in the backend directory and save the downloaded model there.
3) Also make `data` folder in the backend directory. 
4) In the backend directory run the requirements.txt file.
5) Run the backend server (cd into the directory) `uvicorn main:app --reload`
6) Keep the backend server running and cd into the frontend directory.
7) Build the frontend app using `npm install` and then run the app using `npm start`
8) The app will run on `http://localhost:3000`
