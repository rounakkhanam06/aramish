import catForYou from '../assets/CategorySection/categoryForU-removebg-preview.webp';
import catBeauty from '../assets/CategorySection/Category1-removebg-preview.webp';
import catToys from '../assets/CategorySection/Category2-removebg-preview.webp';
import catJewellery from '../assets/CategorySection/Category3-removebg-preview.webp';
import catElectronics from '../assets/CategorySection/Category4-removebg-preview.webp';
import catStationery from '../assets/CategorySection/Category5-removebg-preview.webp';
import catFashion from '../assets/CategorySection/Category6-removebg-preview.webp';
import catGifting from '../assets/CategorySection/Category7-removebg-preview.webp';

export const CATEGORIES = [
  { id: 'for-you', name: 'For You', icon: 'ShoppingBag', image: catForYou },
  { id: 'formal-shoes', name: 'Formal Shoes', icon: 'Shirt', image: catBeauty },
  { id: 'casual-shoes', name: 'Casual Shoes', icon: 'Gamepad2', image: catToys },
  { id: 'boots', name: 'Boots', icon: 'Sparkles', image: catJewellery },
  { id: 'sandals', name: 'Sandals', icon: 'Monitor', image: catElectronics },
  { id: 'ethnic-footwear', name: 'Ethnic Footwear', icon: 'Gift', image: catStationery },
];

import banner1 from '../assets/Banner/footwear1.png';
import banner2 from '../assets/Banner/footwear2.png';

export const BANNERS = [
  { id: 1, image: banner1 },
  { id: 2, image: banner2 }
];

export const VALUE_PROPS = [
  { id: 1, title: "Free Delivery", desc: "No min. order", icon: "Truck" },
  { id: 2, title: "Easy Returns", desc: "7 days easy", icon: "RotateCcw" },
  { id: 3, title: "Secure Payment", desc: "100% safe", icon: "ShieldCheck" },
  { id: 4, title: "Best Price", desc: "Promise", icon: "Award" },
];

export const PLAY_AND_WIN = [
  {
    id: 'game-1',
    name: 'Spin & Win',
    desc: 'Win Coins Daily',
    icon: 'Compass',
    color: 'bg-rose-50 text-rose-500 border-rose-100',
    hoverColor: 'hover:bg-rose-100 hover:border-rose-200'
  },
  {
    id: 'game-2',
    name: 'Daily Quiz',
    desc: 'Test Your Brain',
    icon: 'HelpCircle',
    color: 'bg-gold/10 text-gold border-gold/20',
    hoverColor: 'hover:bg-gold/10 hover:border-gold/20'
  },
  {
    id: 'game-3',
    name: 'Scratch Card',
    desc: 'Scratch & Earn',
    icon: 'Layers',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    hoverColor: 'hover:bg-amber-100 hover:border-amber-200'
  },
  {
    id: 'game-4',
    name: 'Treasure Hunt',
    desc: 'Find & Win',
    icon: 'MapPin',
    color: 'bg-sky-50 text-sky-500 border-sky-100',
    hoverColor: 'hover:bg-sky-100 hover:border-sky-200'
  }
];

export const NOTIFICATIONS = [
  {
    id: 1,
    title: "Order Delivered!",
    message: "Your order for Oversized Tee has been delivered successfully.",
    time: "2 hours ago",
    read: false,
    type: "order"
  },
  {
    id: 2,
    title: "Crazy Deal Alert 🔥",
    message: "Up to 50% off on premium items! Grab them before they're gone.",
    time: "5 hours ago",
    read: false,
    type: "promo"
  },
  {
    id: 3,
    title: "Price Drop on your Wishlist",
    message: "Pink Lip Gloss is now available at 20% off. Shop now!",
    time: "1 day ago",
    read: true,
    type: "wishlist"
  }
];

