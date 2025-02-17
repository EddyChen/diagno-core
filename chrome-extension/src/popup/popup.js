async function processScreenshot(screenshot) {
  try {
    const config = await configManager.loadConfig();
    
    // OCR Processing
    const ocrUrl = new URL(config.services.ollama.endpoints.ocr, config.services.ollama.baseUrl);
    const ocrResponse = await fetch(ocrUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.models.ocr,
        prompt: "Extract text from this image",
        image: screenshot,
        options: {
          temperature: config.ollama.temperature,
          top_p: config.ollama.topP
        }
      }),
      timeout: config.ollama.timeout
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR service returned ${ocrResponse.status}`);
    }

    const ocrResult = await ocrResponse.json();
    
    // Analysis Processing
    const analysisUrl = new URL(config.services.ollama.endpoints.analysis, config.services.ollama.baseUrl);
    const analysisResponse = await fetch(analysisUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollama.models.analysis,
        prompt: `Analyze this text and suggest solutions:\n${ocrResult.text}`,
        options: {
          temperature: config.ollama.temperature,
          top_p: config.ollama.topP
        }
      }),
      timeout: config.ollama.timeout
    });

    if (!analysisResponse.ok) {
      throw new Error(`Analysis service returned ${analysisResponse.status}`);
    }

    const analysisResult = await analysisResponse.json();
    
    // Update UI with results
    document.getElementById('extracted-text').textContent = ocrResult.text;
    document.getElementById('suggestions').textContent = analysisResult.text;
    
    // Enable submit button
    document.getElementById('submit-button').disabled = false;
    
  } catch (error) {
    console.error('Error processing screenshot:', error);
    showError(`Error processing screenshot: ${error.message}`);
  }
}

async function submitIssue() {
  try {
    const config = await configManager.loadConfig();
    
    const reportUrl = new URL(config.services.report.endpoint, config.services.report.baseUrl);
    const response = await fetch(reportUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        text: document.getElementById('extracted-text').textContent,
        suggestions: document.getElementById('suggestions').textContent,
        screenshot: document.getElementById('screenshot').src,
        metadata: {
          url: document.getElementById('page-url').textContent,
          timestamp: new Date().toISOString()
        }
      }),
      timeout: config.ollama.timeout
    });

    if (!response.ok) {
      throw new Error(`Report service returned ${response.status}`);
    }

    showMessage('Issue submitted successfully!', 'success');
    setTimeout(() => window.close(), 2000);
    
  } catch (error) {
    console.error('Error submitting issue:', error);
    showError(`Error submitting issue: ${error.message}`);
  }
} 