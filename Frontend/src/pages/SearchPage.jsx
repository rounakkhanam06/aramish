import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, TrendingUp, X, Mic } from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import { cachedFetch } from '../utils/apiCache';
import { useApp } from '../context/AppContext';
import toast from '../utils/toast';

export default function SearchPage() {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useApp();
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(localQuery);
  
  const [trendingSearches, setTrendingSearches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceRecognition, setVoiceRecognition] = useState(null);
  const [spokenText, setSpokenText] = useState('');

  const inputRef = useRef(null);
  const activeRequestRef = useRef(null);
  const hasFinishedRef = useRef(false);

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true; // live feedback
      recognition.lang = 'en-US';

      hasFinishedRef.current = false;
      setIsListening(true);
      setSpokenText('');
      setVoiceRecognition(recognition);

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        let currentText = (finalTranscript || interimTranscript).trim();
        if (currentText.endsWith('.')) {
          currentText = currentText.slice(0, -1);
        }
        setSpokenText(currentText.trim());

        if (finalTranscript) {
          hasFinishedRef.current = true;
          let cleanedFinal = finalTranscript.trim();
          if (cleanedFinal.endsWith('.')) {
            cleanedFinal = cleanedFinal.slice(0, -1);
          }
          const finalCleaned = cleanedFinal.trim();

          // Keep showing it for 1.2 seconds so user can read it, then close and trigger search
          setTimeout(() => {
            setIsListening(false);
            setLocalQuery(finalCleaned);
            toast.success(`Voice search: "${finalCleaned}"`);
          }, 1200);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        console.error('Speech recognition error', event.error);
        if (event.error !== 'aborted') {
          toast.error('Voice recognition error. Please try again.');
        }
      };

      recognition.onend = () => {
        // Safe timeout: if user stopped speaking but finalTranscript wasn't processed yet
        setTimeout(() => {
          if (!hasFinishedRef.current) {
            setIsListening(false);
          }
        }, 1500);
      };

      recognition.start();
    } else {
      toast.error("Your browser doesn't support voice search.");
    }
  };

  const handleCancelVoice = () => {
    if (voiceRecognition) {
      voiceRecognition.abort();
    }
    setIsListening(false);
    setSpokenText('');
  };

  // Auto focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Clear global search query on unmount
  useEffect(() => {
    return () => {
      setSearchQuery('');
    };
  }, [setSearchQuery]);

  // Fetch trending subcategories on mount
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const data = await cachedFetch(`/admin/catalog/products/combined?page=1&limit=20&category=for-you`, { ttl: 60 });
        if (data && data.success && data.subchips) {
          // Extract active subcategories to use as trending searches
          const activeSubchips = Array.from(new Set(
            data.subchips
              .filter(sc => sc.active && sc.subCategoryName)
              .map(sc => sc.subCategoryName)
          ));
          setTrendingSearches(activeSubchips.slice(0, 6)); // top 6
        }
      } catch (err) {
        console.error("Error fetching trending searches:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    fetchTrending();
  }, []);

  // Clear products if search field is empty
  useEffect(() => {
    if (!localQuery.trim()) {
      setProducts([]);
      setDebouncedQuery('');
    }
  }, [localQuery]);

  const triggerSearch = () => {
    setDebouncedQuery(localQuery);
    setSearchQuery(localQuery); // sync with global
  };

  // Debounce logic to automatically search as they type
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(localQuery);
      setSearchQuery(localQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [localQuery, setSearchQuery]);

  // Search API Call
  useEffect(() => {
    const performSearch = async () => {
      const query = (debouncedQuery || '').trim();
      
      if (!query) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const requestId = Math.random().toString(36).substring(7);
      activeRequestRef.current = requestId;

      try {
        const queryParams = new URLSearchParams({
          page: '1',
          limit: '20',
          search: query
        });

        const data = await cachedFetch(`/admin/catalog/products/combined?${queryParams.toString()}`);

        if (activeRequestRef.current === requestId && data && data.success) {
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        if (activeRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const handleClear = () => {
    setLocalQuery('');
    setDebouncedQuery('');
    setSearchQuery('');
    setProducts([]);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleTrendingClick = (term) => {
    setLocalQuery(term);
    setDebouncedQuery(term);
  };

  return (
    <div className="bg-surface min-h-screen font-sans">
      {/* Search Header */}
      <div className="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-200 p-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-full text-[#02006c]">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 relative flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-transparent focus-within:border-orange-200 focus-within:bg-white transition-all shadow-3xs">
          <button 
            onClick={triggerSearch}
            className="p-1 hover:bg-slate-200 rounded-full text-slate-400 mr-1 active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search products, brands..."
            className="w-full bg-transparent text-sm text-[#02006c] outline-none placeholder-slate-400 font-semibold pr-16"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                triggerSearch();
              }
            }}
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {localQuery && (
              <button onClick={handleClear} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleVoiceSearch} className="p-1 hover:bg-slate-200 rounded-full text-[#02006c] cursor-pointer">
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {/* State 1: Empty Query - Show Trending */}
        {!localQuery.trim() && (
          <div className="animate-fade-in">
            <h3 className="text-sm font-bold text-[#0B132B] flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Trending Searches
            </h3>
            {initialLoading ? (
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 w-24 bg-slate-200 animate-pulse rounded-full" />
                ))}
              </div>
            ) : trendingSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((term, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTrendingClick(term)}
                    className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-600 shadow-3xs transition-all active:scale-95"
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No trending searches at the moment.</p>
            )}
          </div>
        )}

        {/* State 2: Searching Indicator */}
        {localQuery.trim() && loading && (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#02006c] animate-spin" />
          </div>
        )}

        {/* State 3: Search Results */}
        {localQuery.trim() && !loading && products.length > 0 && (
          <div className="animate-fade-in">
            <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">
              {products.length} Results Found
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {products.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* State 4: No Results Found */}
        {localQuery.trim() && !loading && debouncedQuery && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-[#0B132B] mb-2">No products found</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              We couldn't find anything matching "{debouncedQuery}". Try checking the spelling or use different keywords.
            </p>
          </div>
        )}
      </div>

      {/* Voice Listening Overlay */}
      {isListening && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center text-slate-800 p-6 animate-fade-in">
          {/* Close button */}
          <button 
            onClick={handleCancelVoice}
            className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-500 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Static White Mic Icon */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="w-20 h-20 bg-slate-100 text-[#02006c] rounded-full flex items-center justify-center shadow-xs border border-slate-200">
              <Mic className="w-8 h-8 text-[#02006c]" />
            </div>
          </div>

          <h2 className="text-xl font-bold mb-2 tracking-wide text-[#02006c] nunito-heading">
            {spokenText ? "Heard:" : "Listening..."}
          </h2>
          
          <div className="text-sm text-slate-500 font-medium tracking-wide max-w-xs text-center leading-relaxed h-16 flex items-center justify-center">
            {spokenText ? (
              <span className="text-[#02006c] font-extrabold text-base px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200 shadow-3xs animate-fade-in block">
                "{spokenText}"
              </span>
            ) : (
              'Try saying "Running Shoes" or "Sneakers"'
            )}
          </div>
        </div>
      )}
    </div>
  );
}
