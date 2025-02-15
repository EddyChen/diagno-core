# Web App Issue Reporter Chrome Extension

A Chrome extension that helps users report and resolve issues encountered while using web applications. The extension captures relevant information about the current page, analyzes it using AI, and provides suggestions for resolution.

## Features

- One-click issue reporting
- Automatic screenshot capture
- OCR text extraction from screenshots
- AI-powered issue analysis and suggestions
- Configurable backend services
- Customizable Ollama model settings
- System information collection
- Cookie and metadata capture

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `chrome-extension` directory

## Configuration

1. Click the extension icon and select "Options" (or right-click and choose "Options")
2. Configure the following settings:
   - OCR Service URL
   - Analysis Service URL
   - Report Service URL
   - OCR Model (Ollama)
   - Analysis Model (Ollama)
3. Click "Save Settings" to apply changes

## Backend Services

The extension requires three backend services:

1. **OCR Service**: Extracts text from screenshots using Ollama's vision models
   - Default endpoint: `http://localhost:3000/api/ocr`
   - Supported models: llava (default), other vision-capable models

2. **Analysis Service**: Analyzes issues and provides suggestions using Ollama
   - Default endpoint: `http://localhost:3000/api/analyze`
   - Supported models: mistral (default), other text models

3. **Report Service**: Handles issue reports when suggestions don't resolve the problem
   - Default endpoint: `http://localhost:3000/api/report`

## Usage

1. When encountering an issue on a web page, click the extension icon
2. Click "Report Issue" to start the collection process
3. The extension will:
   - Capture a screenshot
   - Collect page information
   - Extract text using OCR
   - Analyze the issue
4. Review the suggested solutions
5. If a suggestion resolves the issue, click "Issue Resolved"
6. If suggestions don't help, click "Submit Issue" to report the problem

## Development

### Project Structure

```
chrome-extension/
├── manifest.json
├── src/
│   ├── js/
│   │   ├── background.js
│   │   ├── content.js
│   │   ├── popup.js
│   │   └── options.js
│   ├── css/
│   │   ├── popup.css
│   │   └── content.css
│   ├── images/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   ├── popup.html
│   └── options.html
└── README.md
```

### Building for Production

1. Update version number in `manifest.json`
2. Remove any development-only permissions
3. Zip the contents of the `chrome-extension` directory
4. Submit to the Chrome Web Store

## Privacy

The extension collects the following information:
- Page URL and title
- Screenshot of the current page
- Browser cookies for the current domain
- System information (OS, browser version, etc.)
- Console errors and page metadata

All data is processed according to the configured backend services. No data is stored locally except for extension settings.

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request 