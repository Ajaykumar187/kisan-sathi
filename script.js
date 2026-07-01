const apiKey = "Paste_Your_Google_API_Key_Here"; // Replace with your actual API key
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

const userQueryEl = document.getElementById('userQuery');
const submitBtn = document.getElementById('submitBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const adviceOutput = document.getElementById('adviceOutput');       
const sourceOutput = document.getElementById('sourceOutput');
const cityInputEl = document.getElementById('cityInput');
const searchWeatherBtn = document.getElementById('searchWeatherBtn');
const weatherLoadingIndicator = document.getElementById('weatherLoadingIndicator');
const weatherOutput = document.getElementById('weatherOutput');
const marketCityInputEl = document.getElementById('marketCityInput');
const searchMarketBtn = document.getElementById('searchMarketBtn');
const marketLoadingIndicator = document.getElementById('marketLoadingIndicator');
const marketPriceOutput = document.getElementById('marketPriceOutput');
const marketPricesBody = document.getElementById('marketPricesBody');

        
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

        
async function callGeminiApi(payload, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429 && i < retries - 1) {
                const delayTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
                await delay(delayTime);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Gemini API Fetch Failed (Status: ${response.status}):`, errorText);
                throw new Error(`HTTP error! status: ${response.status}. See console for details.`);
            }
               
            return response.json();
              
        } catch (error) {
            if (i === retries - 1) {
                throw new Error(`Failed to fetch after ${retries} attempts: ${error.message}`);
            }
               
            const delayTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
            await delay(delayTime);
        }
    }
    throw new Error("Exceeded maximum retries for API call.");
}

       
async function fetchWeather() {
    const city = cityInputEl.value.trim();
    if (!city) {
        weatherOutput.innerHTML = `<p class="text-red-600 font-bold text-sm">Please enter a city or pin code.</p>`;
        return;
    }
         
    searchWeatherBtn.disabled = true;
    searchWeatherBtn.classList.add('opacity-50', 'cursor-not-allowed');
    weatherLoadingIndicator.classList.remove('hidden');
    weatherOutput.innerHTML = '';
            
    const weatherPrompt = `Find the current, most relevant weather conditions for the location "${city}". Extract the following information and present it in a simple, structured list format, using HTML list items (<li>):
    1. Current Temperature and Condition (e.g., 28°C, Clear Skies)
    2. Humidity (e.g., 55%)
    3. Wind Speed and Direction (e.g., 8 km/h NE)
    
    4. Precipitation/Rain Chance (e.g., 10% Today)
    5. A one-sentence, practical farming advice based on the reported weather (e.g., Ideal time for light tilling.).
         
    Format each item as an HTML list item (<li>) with the label in a <strong> tag (e.g., <li><strong>Current:</strong> 28°C, Clear Skies</li>).
         
    If the data cannot be found, output a simple error message.`;

    const payload = {          
        contents: [{ parts: [{ text: weatherPrompt }] }],
        tools: [{ "google_search": {} }],
        generationConfig: { 
            temperature: 0.1, 
        }
    };
 
    try {
        const result = await callGeminiApi(payload);
        const candidate = result.candidates?.[0];
        
        if (result.error) {
            throw new Error(`API returned error: ${result.error.message}`);
        }
        
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            const formattedText = text
            .replace(/\* \*\*/g, '<li><strong>') 
            .replace(/\*\*/g, '</strong>')
            .replace(/\* /g, '<li>') 
            .replace(/\n/g, ''); 
                        
            weatherOutput.innerHTML = `<ul class="space-y-3 text-gray-700">${formattedText}</ul>`;
            
        } else {
            weatherOutput.innerHTML = `<p class="text-red-600 font-bold text-sm">Could not find weather data for ${city}. Please try a different location.</p>`;
        }

    } catch (error) {
        console.error("Weather API Error:", error);
        weatherOutput.innerHTML = `<p class="text-red-600 font-bold text-sm">Failed to fetch weather. Network error or API issue.</p>
        <p class="text-red-500 text-xs mt-1">Error Detail: ${error.message || 'Check browser console for details.'}</p>`;
    } finally {
        searchWeatherBtn.disabled = false;
        searchWeatherBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        weatherLoadingIndicator.classList.add('hidden');
    }
}
        
async function fetchMarketPrices() {
    const city = marketCityInputEl.value.trim();
    if (!city) {
        marketPricesBody.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-red-600 font-bold">Please enter a market or city name.</td></tr>`;
        return;
    }
    
    searchMarketBtn.disabled = true;
    searchMarketBtn.classList.add('opacity-50', 'cursor-not-allowed');
    marketLoadingIndicator.classList.remove('hidden');
    marketPricesBody.innerHTML = ''; 
    marketPriceOutput.querySelector('p').textContent = `Fetching latest prices for ${city}...`;
    
    const marketPrompt = `Find the latest daily APMC Mandi prices for major commodities (like Wheat, Rice, Bajra, Maize, or common vegetables/pulses) in the city/market of "${city}". Please provide the result as a simple, comma-separated list of three to five items, where each item contains the Commodity Name, Unit of Measure (like Quintal or Kg), and Price in Indian Rupees (₹). DO NOT include any introductory or concluding text, only the list.
    
    Example format:
    Wheat, Quintal, ₹ 2450
    Rice, Quintal, ₹ 1980`;

    const payload = {
        contents: [{ parts: [{ text: marketPrompt }] }],
        tools: [{ "google_search": {} }],
        generationConfig: { 
        temperature: 0.1, 
    }
};

try {
    const result = await callGeminiApi(payload);
    const candidate = result.candidates?.[0];
    
    if (result.error) {
        throw new Error(`API returned error: ${result.error.message}`);
    }

    if (candidate && candidate.content?.parts?.[0]?.text) {
        const rawText = candidate.content.parts[0].text.trim();
        const lines = rawText.split('\n');
        let tableRows = '';
        let commoditiesFound = 0;
        
        lines.forEach(line => {
            const parts = line.split(',').map(part => part.trim());
        
            if (parts.length >= 3) {    
                const commodity = parts[0];
                const price = parts[parts.length - 1]; 
                const unit = parts.slice(1, parts.length - 1).join(', ').trim();

                const priceDisplay = `${price} (${unit})`;
                                        
                tableRows += `
                <tr class="border-b">
                <td class="py-2 text-gray-800">${commodity}</td>
                <td class="py-2 text-right font-medium text-[#4d7c0f]">${priceDisplay}</td>
                </tr>
                `;
                
                commoditiesFound++;
                
            }
        });
        
        if (commoditiesFound > 0) {
            marketPricesBody.innerHTML = tableRows;
            marketPriceOutput.querySelector('p').textContent = `Latest prices for ${city} (Prices are indicative):`;
        } else {
            marketPricesBody.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-gray-500">No structured price data found for ${city}. Try a different query.</td></tr>`;
            marketPriceOutput.querySelector('p').textContent = `Could not find detailed price list for ${city}.`;
        }
        
    } 
    else {
        marketPricesBody.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-red-600 font-bold">Failed to retrieve data for market prices.</td></tr>`;
    }
    
} catch (error) {
    console.error("Market Price API Error:", error);
    marketPricesBody.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-red-600 font-bold">Failed to fetch market prices. Error Detail: ${error.message}</td></tr>`;
} finally {
    searchMarketBtn.disabled = false;
    searchMarketBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    marketLoadingIndicator.classList.add('hidden');
}
}

async function fetchCropAdvice() {
    const userQuery = userQueryEl.value.trim();
    
    if (!userQuery) {
        adviceOutput.innerHTML = `<p class="text-red-600 font-bold">Please enter a question about farming or crops.</p>`;
        sourceOutput.innerHTML = '';
        return;
    }

    submitBtn.disabled = true;    
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    loadingIndicator.classList.remove('hidden');
    adviceOutput.innerHTML = '';
    sourceOutput.innerHTML = '';

    
    const personaPrompt = "Act as the 'Kisan Sathi' (Farmer's Friend), a highly knowledgeable and practical agricultural expert for Indian farmers. Provide concise, accurate, and actionable advice, limited to 2-3 paragraphs. You must base your response only on grounded information from Google Search. Now, please answer the user's query: ";
    const fullQuery = personaPrompt + userQuery;
    const payload = {
        contents: [{ parts: [{ text: fullQuery }] }],
        tools: [{ "google_search": {} }],
    };

    try {
        const result = await callGeminiApi(payload);
        const candidate = result.candidates?.[0];
        
        if (result.error) {
            throw new Error(`API returned error: ${result.error.message}`);
        }
        
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
        
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                .map(attribution => ({
                    uri: attribution.web?.uri,
                    title: attribution.web?.title,
                }))
                .filter(source => source.uri && source.title);
            }
            
            adviceOutput.innerHTML = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;

            if (sources.length > 0) {
                let sourcesHtml = '<strong>Sources:</strong><ul class="list-disc ml-5 mt-2 space-y-1">';
                sources.forEach((source) => {
                    sourcesHtml += `<li><a href="${source.uri}" target="_blank" class="source-link">${source.title}</a></li>`;
                });
                sourcesHtml += '</ul>';
                sourceOutput.innerHTML = sourcesHtml;
            } else {
                sourceOutput.innerHTML = '<p class="text-gray-500">No external sources were directly cited for this response.</p>';
            }
            
        } else {
            throw new Error("Received an empty or malformed response from the AI Advisor.");
        }
        
    } catch (error) {
        console.error("Gemini API Error:", error);
        adviceOutput.innerHTML = `<p class="text-red-600 font-bold">Sorry, an error occurred while fetching advice. Please try again.</p><p class="text-red-600">Error Detail: ${error.message}</p>`;
        sourceOutput.innerHTML = '';
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        loadingIndicator.classList.add('hidden');
    }
}

window.fetchCropAdvice = fetchCropAdvice;
window.fetchWeather = fetchWeather;
window.fetchMarketPrices = fetchMarketPrices;