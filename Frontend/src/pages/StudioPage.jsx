import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Heart, MessageCircle, Share2, ShoppingBag, Gift, ArrowLeft, CheckCircle2, Play, Edit2, Trash2, X, Copy, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import OptimizedImage from '../components/ui/OptimizedImage';
import { getImageUrl } from '../utils/imageHelper';
import analytics from '../utils/analytics';

// Optimized Video component with preloading and unmuting control
const ReelVideo = ({ src, onVisible, isMuted, toggleMute, active, onDoubleTap }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const reportedVisibility = useRef(false);

  // Play/pause control based on active index
  useEffect(() => {
    if (videoRef.current) {
      if (active) {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => {
            console.log('Autoplay blocked, waiting for user interaction:', e);
            setIsPlaying(false);
          });
        if (onVisible && !reportedVisibility.current) {
          onVisible();
          reportedVisibility.current = true;
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [active, onVisible]);

  // Handle intersection observer to pause when scrolled out
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      });
    }, options);

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const clickTimeoutRef = useRef(null);

  const handleTap = (e) => {
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (onDoubleTap) {
        onDoubleTap(e);
      }
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
          } else {
            videoRef.current.play()
              .then(() => setIsPlaying(true))
              .catch(err => console.log(err));
          }
        }
      }, 250);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 z-0 cursor-pointer select-none will-change-transform" 
      onClick={handleTap}
    >
      <video 
        ref={videoRef}
        src={src} 
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        preload="auto"
      />
      
      {/* Play Icon overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 pointer-events-none">
          <div className="w-14 h-14 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md">
            <Play className="w-6 h-6 text-white fill-white opacity-85 ml-1" />
          </div>
        </div>
      )}

      {/* Mute toggle overlay indicator */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="absolute top-20 right-4 z-30 p-2.5 bg-black/30 backdrop-blur-md rounded-full border border-white/10 text-white"
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default function StudioPage() {
  const { addToCart, user, socketRef } = useApp();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [shareOverlayPost, setShareOverlayPost] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default muted to ensure WebView autoplay starts successfully
  
  // Track active slide index for swipe navigation
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  // Floating heart animation states (Double Tap to Like)
  const [hearts, setHearts] = useState([]);

  // Parse share bridge
  const queryParams = new URLSearchParams(routerLocation.search);
  const sharedReelId = queryParams.get('reelId');

  const fetchReels = async () => {
    try {
      setLoading(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels`);
      const data = await res.json();
      if (res.ok && data.success) {
        const userId = user?._id || user?.id;
        const formatted = (data.reels || []).map(r => ({
          id: r._id,
          username: r.username,
          desc: r.caption || '',
          likes: r.likes?.length || 0,
          comments: r.comments?.length || 0,
          rawComments: r.comments || [],
          shares: Math.floor(Math.random() * 50) + 5,
          views: r.views || 0,
          isLiked: userId ? r.likes?.includes(userId) : false,
          product: r.productId ? {
            id: r.productId._id,
            name: r.productId.name,
            price: r.productId.sellingPrice,
            originalPrice: r.productId.mrp || r.productId.sellingPrice,
            image: r.productId.images?.[0] ? getImageUrl(r.productId.images[0]) : "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800",
            discount: r.productId.discountLabel || "10% OFF"
          } : null,
          videoUrl: getImageUrl(r.video)
        }));

        if (sharedReelId) {
          const sharedIndex = formatted.findIndex(p => p.id === sharedReelId);
          if (sharedIndex > -1) {
            const sharedPost = formatted.splice(sharedIndex, 1)[0];
            formatted.unshift(sharedPost);
          }
        }
        setPosts(formatted);
      }
    } catch (err) {
      console.error('Error loading reels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, [user]);

  // Live WebSocket Likes
  useEffect(() => {
    if (socketRef && socketRef.current) {
      const socket = socketRef.current;
      socket.on('reel_like_status', ({ reelId, isLiked, likesCount, userId }) => {
        const currentUserId = user?._id || user?.id;
        setPosts(prev => prev.map(p => p.id === reelId ? {
          ...p,
          isLiked: currentUserId && currentUserId === userId ? isLiked : p.isLiked,
          likes: likesCount
        } : p));
      });

      return () => {
        socket.off('reel_like_status');
      };
    }
  }, [socketRef, user]);

  // Handle Scroll to capture Active Slide Index (Optimized for preloading)
  const handleScroll = (e) => {
    const scrollPos = e.target.scrollTop;
    const height = e.target.clientHeight;
    const index = Math.round(scrollPos / height);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  // WebSocket / HTTP Reel Like Trigger
  const handleLike = async (postId) => {
    analytics.trackStudioAction('greeting_liked', { reelId: postId });
    if (!user) {
      navigate('/login');
      return;
    }

    // 1. Optimistic UI update for instant feedback
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likes: nextLiked ? p.likes + 1 : Math.max(0, p.likes - 1)
        };
      }
      return p;
    }));

    // 2. Try sending via WebSockets first
    let viaSocket = false;
    if (socketRef && socketRef.current && socketRef.current.connected) {
      const userId = user._id || user.id;
      socketRef.current.emit('toggle_reel_like', { userId, reelId: postId });
      viaSocket = true;
    }

    // 3. HTTP Fallback if Socket is not connected
    if (!viaSocket) {
      try {
        const token = localStorage.getItem('userToken');
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/reels/${postId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          // Sync with backend confirmed state
          setPosts(prev => prev.map(p => p.id === postId ? {
            ...p,
            isLiked: data.isLiked,
            likes: data.likesCount
          } : p));
        } else {
          // Revert optimistic update
          fetchReels();
        }
      } catch (err) {
        console.error('HTTP reel like fallback error:', err);
        // Revert optimistic update
        fetchReels();
      }
    }
  };

  // Double Tap to Like
  const lastTapRef = useRef(0);
  const handleDoubleTap = (e, post) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Trigger like if not already liked
      if (!post.isLiked) {
        handleLike(post.id);
      }

      // Add a floating heart animation
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newHeart = { id: now, x, y };
      setHearts(prev => [...prev, newHeart]);
      
      // Clean up heart after animation
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== now));
      }, 800);
    }
    lastTapRef.current = now;
  };

  const handleComment = (postId) => {
    setActiveCommentPost(postId);
  };

  // Comment logic
  const submitComment = async () => {
    if (!newComment.trim()) return;
    if (!user) {
      navigate('/login');
      return;
    }
    const token = localStorage.getItem('userToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels/${activeCommentPost}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: newComment })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(prev => prev.map(post => {
          if (post.id === activeCommentPost) {
            return { 
              ...post, 
              comments: data.commentsCount,
              rawComments: [...post.rawComments, data.comment]
            };
          }
          return post;
        }));
        setNewComment("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.text);
  };

  const submitEditComment = async (commentId) => {
    if (!editingCommentText.trim()) return;
    const token = localStorage.getItem('userToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels/${activeCommentPost}/comment/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: editingCommentText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(prev => prev.map(post => {
          if (post.id === activeCommentPost) {
            return {
              ...post,
              rawComments: post.rawComments.map(c => c._id === commentId ? data.comment : c)
            };
          }
          return post;
        }));
        setEditingCommentId(null);
        setEditingCommentText("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    const token = localStorage.getItem('userToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/reels/${activeCommentPost}/comment/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(prev => prev.map(post => {
          if (post.id === activeCommentPost) {
            return {
              ...post,
              comments: data.commentsCount,
              rawComments: post.rawComments.filter(c => c._id !== commentId)
            };
          }
          return post;
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVisible = async (postId) => {
    analytics.trackStudioAction('greeting_viewed', { reelId: postId });
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await fetch(`${apiBase}/reels/${postId}/view`, {
        method: 'POST'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const triggerShareLink = (post) => {
    setShareOverlayPost(post);
    setCopied(false);
  };

  const handleCopyLink = async (postId) => {
    analytics.trackStudioAction('greeting_shared', { reelId: postId });
    try {
      const shareUrl = `${window.location.origin}/#/studio?reelId=${postId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async (post) => {
    analytics.trackStudioAction('greeting_shared', { reelId: post.id });
    const shareUrl = `${window.location.origin}/#/studio?reelId=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Aramish Studio Reel by @${post.username}`,
          text: post.desc || 'Check out this awesome review reel on Aramish!',
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          triggerShareLink(post);
        }
      }
    } else {
      triggerShareLink(post);
    }
  };

  const handleAddToCart = (product) => {
    analytics.trackStudioAction('greeting_product_cart_add', { productId: product.id || product._id });
    if (!user) {
      navigate('/login');
      return;
    }
    addToCart(product);
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="bg-black w-full md:max-w-md md:mx-auto h-[100dvh] overflow-y-scroll snap-y snap-mandatory scrollbar-hide text-white relative select-none md:shadow-2xl md:border-x md:border-slate-800"
      style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'auto' }}
    >
      
      {/* Top Navigation Overlay */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent max-w-md mx-auto font-sans">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface/10 rounded-full transition-colors cursor-pointer">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="bg-[#0B132B] text-white px-2 py-1 rounded text-[10px] font-black tracking-wider shadow-lg flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-surface rounded-full animate-pulse"></span>
          LIVE
        </div>
      </div>

      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-950">
          <span className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Studio Reels...</p>
        </div>
      ) : posts.length > 0 ? (
        posts.map((post, index) => {
          const isActive = index === activeIndex;
          
          return (
            <div 
              key={post.id} 
              className="w-full h-[100dvh] snap-start snap-always relative bg-slate-900 flex justify-center items-center overflow-hidden font-sans"
            >
              {/* Media Background with active check */}
              <ReelVideo 
                src={post.videoUrl} 
                onVisible={() => handleVisible(post.id)} 
                isMuted={isMuted}
                toggleMute={() => setIsMuted(!isMuted)}
                active={isActive}
                onDoubleTap={(e) => handleDoubleTap(e, post)}
              />

              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>

              {/* Float Hearts Overlay (Double tap effect) */}
              {isActive && hearts.map(heart => (
                <div 
                  key={heart.id}
                  style={{ left: heart.x - 40, top: heart.y - 40 }}
                  className="absolute pointer-events-none z-40 animate-ping"
                >
                  <Heart className="w-20 h-20 text-rose-500 fill-rose-500 drop-shadow-lg" />
                </div>
              ))}

              {/* Right Action Panel */}
              <div className="absolute right-4 bottom-6 flex flex-col items-center gap-6 z-20">
                <button onClick={(e) => { e.stopPropagation(); handleLike(post.id); }} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform">
                  <div className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                    <Heart className={`w-6 h-6 ${post.isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                  </div>
                  <span className="text-[11px] font-semibold drop-shadow-md">{formatNumber(post.likes)}</span>
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleComment(post.id); }} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform">
                  <div className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold drop-shadow-md">{formatNumber(post.comments)}</span>
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleShare(post); }} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform">
                  <div className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                    <Share2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold drop-shadow-md">Share</span>
                </button>

                {post.product && (
                  <button onClick={(e) => { e.stopPropagation(); handleAddToCart(post.product); }} className="flex flex-col items-center gap-1 cursor-pointer hover:scale-110 transition-transform">
                    <div className="w-10 h-10 bg-black/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                  </button>
                )}
              </div>

              {/* Bottom Info Panel */}
              <div className="absolute left-4 bottom-6 right-16 z-20 flex flex-col gap-3">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-white overflow-hidden bg-surface flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${post.username}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-[14px] font-bold drop-shadow-md">@{post.username}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-white" />
                    </div>
                    <span className="text-[11px] text-white/80 drop-shadow-md">{post.views} Views</span>
                  </div>
                </div>

                {/* Product Tag Overlay */}
                {post.product && (
                  <div 
                    className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2.5 flex items-center gap-3 w-full max-w-[280px] justify-between cursor-pointer hover:bg-black/60 transition-colors" 
                    onClick={(e) => { e.stopPropagation(); navigate(`/product/${post.product.id}`); }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <OptimizedImage src={post.product.image} type="product" className="w-10 h-10 rounded-lg bg-surface shrink-0" alt="product" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-bold truncate text-white drop-shadow-md">{post.product.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-black text-white drop-shadow-md">₹{post.product.price}</span>
                          <span className="text-[9px] text-[#0B132B] font-black bg-surface/95 px-1 rounded shrink-0">{post.product.discount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#0B132B] text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 ml-1.5 hover:bg-gold transition-colors">
                      Shop Now
                    </div>
                  </div>
                )}

                {/* Description */}
                <p className="text-[13px] text-white font-medium drop-shadow-md leading-snug line-clamp-2 mt-1">
                  {post.desc}
                </p>
              </div>
            </div>
          );
        })
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 uppercase tracking-widest text-xs font-bold bg-slate-950">
          No reels found in this tab.
        </div>
      )}

      {/* Comments Modal */}
      {activeCommentPost && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[100]" onClick={() => { setActiveCommentPost(null); setEditingCommentId(null); }}></div>
          <div className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-3xl h-[60dvh] z-[110] flex flex-col max-w-md mx-auto shadow-2xl animate-in slide-in-from-bottom-full duration-300 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-bold text-slate-800 text-[15px] uppercase tracking-wider">
                Comments ({posts.find(p => p.id === activeCommentPost)?.comments || 0})
              </h3>
              <button onClick={() => { setActiveCommentPost(null); setEditingCommentId(null); }} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-800" style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
              {(posts.find(p => p.id === activeCommentPost)?.rawComments || []).map((comment) => {
                const isMyComment = user && (user._id === comment.userId || user.id === comment.userId);
                const isEditingThis = editingCommentId === comment._id;

                return (
                  <div key={comment._id} className="flex gap-3 items-start justify-between">
                    <div className="flex gap-3 items-start flex-1">
                      <div className="w-8 h-8 rounded-full bg-surface overflow-hidden flex-shrink-0 border border-white/10">
                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${comment.username}`} alt="avatar" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-bold text-slate-500">@{comment.username}</h4>
                        {isEditingThis ? (
                          <div className="mt-1 flex gap-2">
                            <input
                              type="text"
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="flex-1 border border-white/10 px-3 py-1.5 text-xs font-bold rounded-lg focus:outline-none"
                            />
                            <button 
                              onClick={() => submitEditComment(comment._id)}
                              className="bg-indigo-600 text-white px-3 rounded-lg text-[10px] font-black uppercase"
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setEditingCommentId(null)}
                              className="bg-surface text-slate-500 px-2 rounded-lg text-[10px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <p className="text-[13px] text-slate-800 mt-0.5 leading-snug">{comment.text}</p>
                        )}
                      </div>
                    </div>

                    {isMyComment && !isEditingThis && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button 
                          onClick={() => handleEditComment(comment)}
                          className="p-1.5 hover:bg-surface text-slate-400 hover:text-indigo-600 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteComment(comment._id)}
                          className="p-1.5 hover:bg-surface text-slate-400 hover:text-red-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!posts.find(p => p.id === activeCommentPost)?.rawComments?.length) && (
                <div className="text-center text-slate-400 text-[12px] mt-12 font-bold uppercase tracking-widest">
                  No comments yet.
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            <div className="p-4 border-t border-white/10 flex items-center gap-2 bg-surface rounded-b-3xl">
              <div className="w-8 h-8 rounded-full bg-surface overflow-hidden flex-shrink-0">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user ? user.name : 'guest'}`} alt="your avatar" />
              </div>
              <input 
                type="text" 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Add comment..." 
                className="flex-1 bg-surface text-slate-800 text-[13px] font-bold rounded-xl px-4 py-2.5 border border-white/10 outline-none focus:ring-2 focus:ring-[#0B132B]/30"
              />
              <button 
                onClick={submitComment}
                disabled={!newComment.trim()}
                className="bg-[#0B132B] text-white px-4 py-2.5 rounded-xl disabled:opacity-50 text-xs font-bold uppercase tracking-wider"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share Link Bridge Overlay */}
      {shareOverlayPost && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="bg-surface rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setShareOverlayPost(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-base uppercase tracking-wider text-slate-900">Share this Reel</h3>
            
            <div className="flex bg-surface border border-white/10 rounded-xl p-3 items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">
                {window.location.origin}/#/studio?reelId={shareOverlayPost.id}
              </span>
              <button 
                onClick={() => handleCopyLink(shareOverlayPost.id)}
                className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center leading-relaxed">
              Anyone with this share bridge link will land directly on this specific review reel!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};
