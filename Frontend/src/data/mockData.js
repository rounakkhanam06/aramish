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

