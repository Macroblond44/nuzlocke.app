import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get('savFile');
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Save the uploaded file temporarily
    const tempFilePath = join(process.cwd(), 'temp-sav-file.sav');
    const fileBuffer = await file.arrayBuffer();
    writeFileSync(tempFilePath, Buffer.from(fileBuffer));
    
    console.log('🔍 [API] Processing .sav file:', file.name, file.size, 'bytes');
    
    // Execute the Python parser
    const pythonScript = join(process.cwd(), 'test-python-parser.py');
    const pythonProcess = spawn('python3', [pythonScript, tempFilePath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        try {
          unlinkSync(tempFilePath);
        } catch (error) {
          console.warn('Could not delete temp file:', error);
        }
        
        if (code !== 0) {
          console.error('Python script failed:', stderr);
          resolve(new Response(JSON.stringify({ 
            error: 'Failed to parse save file',
            details: stderr 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }));
          return;
        }
        
        console.log('🔍 [API] Python script output:', stdout);
        
        // Extract JSON from the output (look for JSON OUTPUT section)
        let pokemonData;
        try {
          // Find the JSON section in the output
          const jsonStart = stdout.indexOf('{');
          if (jsonStart === -1) {
            throw new Error('No JSON found in output');
          }
          
          // Extract JSON from the output
          const jsonOutput = stdout.substring(jsonStart);
          pokemonData = JSON.parse(jsonOutput);
        } catch (parseError) {
          console.error('Failed to parse JSON output:', parseError);
          console.error('Raw output:', stdout);
          resolve(new Response(JSON.stringify({ 
            error: 'Failed to parse JSON output from Python script',
            details: parseError.message,
            rawOutput: stdout
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }));
          return;
        }
        
        resolve(new Response(JSON.stringify({
          success: true,
          data: pokemonData,
          rawOutput: stdout
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      });
    });
    
  } catch (error) {
    console.error('Error processing .sav file:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

