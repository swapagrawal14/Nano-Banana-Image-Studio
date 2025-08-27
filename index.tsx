/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import '@tailwindcss/browser';
import { GoogleGenAI, Modality } from "@google/genai";
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

type Mode = 'text-to-image' | 'image-to-image';

type HistoryItem = {
  id: string;
  prompt: string;
  image: string;
};

const textToImageExamples = [
    "A majestic lion wearing a crown, on a throne in a jungle.",
    "A surreal underwater city with glowing jellyfish as streetlights.",
    "An astronaut playing a guitar on the moon, with Earth in the background.",
    "A cozy, magical library inside a giant tree.",
];

const imageToImageExamples = [
    "Turn this into a vibrant, colorful watercolor painting.",
    "Add a steampunk-style pair of goggles to the subject.",
    "Change the season in the photo to a snowy winter.",
    "Make it look like a vintage photograph from the 1920s.",
];

// Helper to convert File to base64
const fileToBase64 = (file: File): Promise<{ mimeType: string, data: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const [header, data] = result.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
            resolve({ mimeType, data });
        };
        reader.onerror = error => reject(error);
    });
};


function App() {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [aiClient, setAiClient] = useState<InstanceType<typeof GoogleGenAI> | null>(null);

  const [mode, setMode] = useState<Mode>('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [inputImageUrl, setInputImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const keyFromSession = sessionStorage.getItem('gemini-api-key');
    if (keyFromSession) {
      setSavedApiKey(keyFromSession);
      setAiClient(new GoogleGenAI({ apiKey: keyFromSession }));
    }
  }, []);

  const handleApiKeySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key) return;
    sessionStorage.setItem('gemini-api-key', key);
    setSavedApiKey(key);
    setAiClient(new GoogleGenAI({ apiKey: key }));
  };

  const handleChangeApiKey = () => {
    sessionStorage.removeItem('gemini-api-key');
    setSavedApiKey(null);
    setAiClient(null);
    setApiKey('');
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputImage(file);
      setInputImageUrl(URL.createObjectURL(file));
      setError('');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!aiClient) {
        setError("API client is not initialized. Please set your API key.");
        return;
    }

    setLoading(true);
    setResultImage(null);
    setResultText(null);
    setError('');

    try {
        let contents;

        if (mode === 'image-to-image') {
            if (!inputImage) {
                setError('Please upload an image for image-to-image generation.');
                setLoading(false);
                return;
            }
            const { mimeType, data } = await fileToBase64(inputImage);
            const imagePart = { inlineData: { data, mimeType } };
            const textPart = { text: prompt };
            contents = { parts: [imagePart, textPart] };
        } else {
            contents = prompt;
        }

        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: contents,
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let foundImage = false;
        let foundText = '';
        let newResultImage: string | null = null;

        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                foundText += part.text + '\n';
            } else if (part.inlineData) {
                const { mimeType, data } = part.inlineData;
                newResultImage = `data:${mimeType};base64,${data}`;
                setResultImage(newResultImage);
                foundImage = true;
            }
        }
        
        if (newResultImage) {
           const newItem: HistoryItem = {
              id: new Date().toISOString(),
              prompt: prompt,
              image: newResultImage,
           };
           setHistory(prevHistory => [newItem, ...prevHistory].slice(0, 12));
        }

        setResultText(foundText.trim() || null);
        if (!foundImage) {
             setError(foundText.trim() ? "The model returned only text." : "The model did not return an image or text.");
        }

    } catch (e) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setPrompt('');
    setInputImage(null);
    setInputImageUrl(null);
    setError('');
    setResultImage(null);
    setResultText(null);
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  if (!savedApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/50 rounded-2xl shadow-2xl ring-1 ring-white/10 backdrop-blur-lg p-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Enter Your Gemini API Key
                </h1>
                <p className="text-md text-slate-400 mt-2">
                    To use the Image Generation Studio, please provide your own API key.
                </p>
            </div>
            <form onSubmit={handleApiKeySubmit}>
                <div className="mb-4">
                    <label htmlFor="api-key" className="sr-only">Gemini API Key</label>
                    <input
                        id="api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Gemini API key here"
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-slate-200 placeholder-slate-500"
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-cyan-600 transition-all duration-200 shadow-lg hover:shadow-cyan-500/50"
                >
                    Continue
                </button>
            </form>
            <p className="text-xs text-slate-500 mt-6 text-center">
                Your API key is stored only in your browser's session storage.
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-200 p-4 sm:p-6 md:p-8">
      <main className="max-w-4xl mx-auto bg-slate-900/50 rounded-2xl shadow-2xl ring-1 ring-white/10 backdrop-blur-lg p-6 sm:p-8">
        <header className="text-center mb-8">
           <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 inline-flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
            Image Generation Studio
          </h1>
          <p className="text-md text-slate-400 mt-2">
            Bring your creative visions to life with the power of Gemini.
          </p>
        </header>

        <div className="mb-8 flex justify-center">
            <div className="bg-slate-800 rounded-lg p-1 flex space-x-1">
                <button onClick={() => handleModeChange('text-to-image')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${mode === 'text-to-image' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700/50'}`}>
                    Text-to-Image
                </button>
                <button onClick={() => handleModeChange('image-to-image')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${mode === 'image-to-image' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700/50'}`}>
                    Image-to-Image
                </button>
            </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'image-to-image' && (
            <div className="mb-6">
              <label htmlFor="image-upload" className="block text-lg font-medium text-slate-300 mb-2">
                Upload Image
              </label>
              <div className="mt-2 group relative flex justify-center rounded-lg border-2 border-dashed border-slate-600 hover:border-purple-400 transition-colors px-6 py-10">
                {inputImageUrl ? (
                    <div className="text-center relative">
                        <img src={inputImageUrl} alt="Input preview" className="mx-auto h-48 w-auto rounded-md shadow-lg" />
                        <button type="button" onClick={() => { setInputImage(null); setInputImageUrl(null); }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 transition-transform hover:scale-110">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                         <svg className="mx-auto h-12 w-12 text-slate-500 group-hover:text-purple-400 transition-colors" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        <div className="mt-4 flex text-sm leading-6 text-slate-400">
                            <label htmlFor="image-upload" className="relative cursor-pointer rounded-md font-semibold text-purple-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 hover:text-purple-300">
                                <span>Upload a file</span>
                                <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs leading-5 text-slate-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="prompt" className="block text-lg font-medium text-slate-300 mb-2">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={mode === 'text-to-image' ? "A futuristic city with flying cars..." : "Add a party hat to the cat..."}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow text-slate-200 placeholder-slate-500"
              rows={4}
              disabled={loading}
              required
            />
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-slate-400 mb-2">
                Inspiration:
            </p>
            <div className="flex flex-wrap gap-2">
                {(mode === 'text-to-image' ? textToImageExamples : imageToImageExamples).map((example, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setPrompt(example)}
                        className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-sm hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                        disabled={loading}
                    >
                        {example}
                    </button>
                ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 disabled:shadow-none"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
             <span className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                Generate
             </span>
            )}
          </button>
        </form>

        {error && (
            <div className="mt-6 p-4 bg-red-900/50 text-red-300 border border-red-700 rounded-lg flex items-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <p><span className="font-bold">Error:</span> {error}</p>
            </div>
        )}
        
        <div className="mt-8">
            {(resultImage || resultText) && (
                <div className="bg-slate-800/50 p-4 sm:p-6 rounded-lg ring-1 ring-white/10">
                    <h2 className="text-2xl font-semibold text-slate-200 mb-4">
                      Result
                    </h2>
                    <div className="space-y-4">
                        {resultImage && (
                            <div className="space-y-4">
                                <img src={resultImage} alt="Generated result" className="w-full rounded-lg shadow-md border border-slate-700" />
                                <a
                                    href={resultImage}
                                    download="generated-image.png"
                                    className="inline-flex items-center justify-center w-full bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                    Download Image
                                </a>
                            </div>
                        )}
                        {resultText && (
                            <div className="p-4 bg-slate-900/70 rounded-lg border border-slate-700">
                                <p className="text-slate-300 whitespace-pre-wrap font-mono text-sm">{resultText}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

      </main>

      {history.length > 0 && (
            <section className="max-w-4xl mx-auto mt-12">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h2 className="text-2xl font-bold text-slate-300">History</h2>
                    <button
                        onClick={handleClearHistory}
                        className="px-3 py-1.5 bg-red-900/60 text-red-300 rounded-lg text-sm hover:bg-red-800/60 transition-colors flex items-center gap-2"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        Clear History
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {history.map((item) => (
                        <div key={item.id} className="group relative cursor-pointer" onClick={() => { setPrompt(item.prompt); window.scrollTo(0, 0); }}>
                            <img src={item.image} alt={item.prompt} className="w-full h-full object-cover rounded-lg aspect-square border-2 border-slate-700 group-hover:border-purple-400 transition-all duration-200 transform group-hover:scale-105"/>
                            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg">
                                <p className="text-xs text-center text-white line-clamp-4">{item.prompt}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

       <footer className="text-center mt-8 text-sm text-slate-500">
            <p>Powered by Gemini API</p>
            <button onClick={handleChangeApiKey} className="mt-2 text-slate-400 hover:text-purple-400 underline transition-colors">
                Change API Key
            </button>
        </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);