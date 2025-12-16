# CS559 Group Project

## How to run locally

This project uses ES Modules, which browsers block via the `file://` protocol. You need to serve the files over HTTP.

### Option 1: Using VS Code Live Server
1. Install the "Live Server" extension in Visual Studio Code.
2. Open the root folder of this repository in VS Code.
3. Right-click `index.html` and select "Open with Live Server."

### Option 2: Using Python HTTP Server
1. Install Python if not available on your system.
2. Open a terminal and navigate to the repository root.
3. Run the command:
   ```
   python -m http.server 8000
   ```
4. Open [http://localhost:8000](http://localhost:8000) in your browser.

**Note:** Opening `index.html` directly via the browser (`file://`) won't work due to ES Module loading restrictions.