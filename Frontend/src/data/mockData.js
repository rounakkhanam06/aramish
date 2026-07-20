import imgTee from '../assets/CrazyDeals/CrazyDeals2.webp';
import imgNecklace from '../assets/CrazyDeals/CrazyDeals3.webp';
import imgWatch from '../assets/CrazyDeals/CrazyDeals4.webp';
import imgTint from '../assets/CrazyDeals/CrazyDeals5.webp';

import beauty1 from '../assets/BeautyProducts/Beauty1.webp';
import beauty2 from '../assets/BeautyProducts/Beauty2.webp';
import beauty3 from '../assets/BeautyProducts/Beauty3.webp';
import beauty4 from '../assets/BeautyProducts/Beauty4.webp';
import beauty5 from '../assets/BeautyProducts/Beauty5.webp';

import gift1 from '../assets/GiftProducts/Gift1.webp';
import gift2 from '../assets/GiftProducts/Gift2.webp';
import gift3 from '../assets/GiftProducts/Gift3.webp';
import gift4 from '../assets/GiftProducts/Gift4.webp';
import gift5 from '../assets/GiftProducts/Gift5.webp';
import gift6 from '../assets/GiftProducts/Gift6.webp';

import elec1 from '../assets/Electronics/Electronics1.webp';
import elec2 from '../assets/Electronics/Electronics2.webp';
import elec3 from '../assets/Electronics/Electronics3.webp';
import elec4 from '../assets/Electronics/Electronics4.webp';
import elec5 from '../assets/Electronics/Electronics5.webp';

import jewel1 from '../assets/JewellaryProducts/Jewellary1.webp';
import jewel2 from '../assets/JewellaryProducts/Jewellary2.webp';
import jewel3 from '../assets/JewellaryProducts/Jewellary3.webp';
import jewel4 from '../assets/JewellaryProducts/Jewellary4.webp';

import toy1 from '../assets/Toys/Toys11.webp';
import toy2 from '../assets/Toys/Toys12.webp';
import toy3 from '../assets/Toys/Toys13.webp';
import toy4 from '../assets/Toys/Toys14.webp';
import toy5 from '../assets/Toys/Toys15.webp';

import stat1 from '../assets/Stationary/Stationary11.webp';
import stat2 from '../assets/Stationary/Stationary12.webp';
import stat3 from '../assets/Stationary/Stationary13.webp';
import stat4 from '../assets/Stationary/Stationary14.webp';
import stat5 from '../assets/Stationary/Stationary15.webp';

import fash1 from '../assets/Fashion/Fashion11.webp';
import fash2 from '../assets/Fashion/Fashion12.webp';
import fash3 from '../assets/Fashion/Fashion13.webp';
import fash4 from '../assets/Fashion/Fashion14.webp';

import elec11 from '../assets/Electrical/Elecrical1.webp';
import elec12 from '../assets/Electrical/Electrical2.webp';
import elec13 from '../assets/Electrical/Electrical3.webp';
import elec14 from '../assets/Electrical/Electrical4.webp';
import elec15 from '../assets/Electrical/Electrical5.webp';

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
  { id: 'beauty', name: 'Beauty', icon: 'Sparkles', image: catBeauty },
  { id: 'gifting', name: 'Gifting', icon: 'Gift', image: catGifting },
  { id: 'electronics', name: 'Electronics', icon: 'Monitor', image: catElectronics },
  { id: 'jewellery', name: 'Jewellery', icon: 'Gem', image: catJewellery },
  { id: 'toys', name: 'Toys', icon: 'Gamepad2', image: catToys },
  { id: 'stationery', name: 'Stationery', icon: 'PenTool', image: catStationery },
  { id: 'fashion', name: 'Fashion', icon: 'Shirt', image: catFashion },
  { id: 'electrical', name: 'Electrical', icon: 'Zap', image: elec11 },
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

export const CRAZY_DEALS = [
  {
    id: 'deal-1',
    name: 'Oversized Tee',
    discount: '-40%',
    price: 599,
    originalPrice: 999,
    rating: 4.8,
    type: 'tee',
    image: imgTee,
    desc: 'Vintage oversized comfort fit raglan tee'
  },
  {
    id: 'deal-2',
    name: 'Layered Necklace',
    discount: '-30%',
    price: 699,
    originalPrice: 999,
    rating: 4.5,
    type: 'necklace',
    image: imgNecklace,
    desc: 'Elegant gold plated multi-layer charm necklace'
  },
  {
    id: 'deal-3',
    name: 'Vintage Watch',
    discount: '-50%',
    price: 1499,
    originalPrice: 2999,
    rating: 4.9,
    type: 'watch',
    image: imgWatch,
    desc: 'Classic luxury gold chain wristwatch & bracelet set'
  },
  {
    id: 'deal-4',
    name: 'Benetint Lip Tint',
    discount: '-35%',
    price: 1299,
    originalPrice: 1999,
    rating: 4.7,
    type: 'tint',
    image: imgTint,
    desc: 'Iconic rose-tinted liquid lip & cheek stain'
  },
  {
    id: 'deal-5',
    name: 'Pink Lip Gloss',
    discount: '-20%',
    price: 899,
    originalPrice: 1199,
    rating: 4.6,
    type: 'makeup',
    image: beauty1,
    desc: 'High-shine hydrating pink lip gloss'
  },
  {
    id: 'deal-6',
    name: 'OFÉLIA Spicy Tint',
    discount: '-40%',
    price: 799,
    originalPrice: 1399,
    rating: 4.8,
    type: 'makeup',
    image: beauty2,
    desc: 'Long-lasting spicy brown/red lip tint'
  },
  {
    id: 'deal-7',
    name: 'medicube Peptide Serum',
    discount: '-15%',
    price: 2499,
    originalPrice: 2999,
    rating: 4.9,
    type: 'skincare',
    image: beauty3,
    desc: 'PDRN Pink Peptide Serum for glowing skin'
  },
  {
    id: 'deal-8',
    name: 'Sunscreen SPF 50',
    discount: '-25%',
    price: 599,
    originalPrice: 799,
    rating: 4.5,
    type: 'skincare',
    image: beauty4,
    desc: 'Water resistant UVB & UBA protection'
  },
  {
    id: 'deal-9',
    name: 'EELHOE Hair Mask',
    discount: '-50%',
    price: 499,
    originalPrice: 999,
    rating: 4.4,
    type: 'haircare',
    image: beauty5,
    desc: 'Keratin hair mask with Maca Essence & Collagen'
  },
  {
    id: 'deal-10',
    name: 'Pink Bow Mug',
    discount: '-15%',
    price: 399,
    originalPrice: 469,
    rating: 4.8,
    type: 'mug',
    image: gift1,
    desc: 'Cute beige ceramic mug with pink bow and polka dots'
  },
  {
    id: 'deal-11',
    name: 'Glass Bow Tumbler',
    discount: '-20%',
    price: 599,
    originalPrice: 749,
    rating: 4.7,
    type: 'tumbler',
    image: gift2,
    desc: 'Ribbed glass tumbler with bamboo lid and glass straw'
  },
  {
    id: 'deal-12',
    name: 'Leather Photo Keychain',
    discount: '-30%',
    price: 299,
    originalPrice: 429,
    rating: 4.9,
    type: 'keychain',
    image: gift3,
    desc: 'Custom leather keychain with hidden photo and calendar'
  },
  {
    id: 'deal-13',
    name: 'Pink Leather Keychain',
    discount: '-25%',
    price: 249,
    originalPrice: 339,
    rating: 4.6,
    type: 'keychain',
    image: gift4,
    desc: 'Personalized pink leather keychain with custom initials'
  },
  {
    id: 'deal-14',
    name: 'Birthday Mini Hamper',
    discount: '-10%',
    price: 899,
    originalPrice: 999,
    rating: 4.5,
    type: 'hamper',
    image: gift5,
    desc: 'Cute pink birthday hamper box with mini accessories'
  },
  {
    id: 'deal-15',
    name: 'Accessories Bouquet',
    discount: '-40%',
    price: 1499,
    originalPrice: 2499,
    rating: 4.8,
    type: 'bouquet',
    image: gift6,
    desc: 'Large gift bouquet with jewelry, nails, and hair accessories'
  },
  {
    id: 'deal-16',
    name: 'Wireless Earbuds',
    discount: '-30%',
    price: 1599,
    originalPrice: 2299,
    rating: 4.7,
    type: 'earbuds',
    image: elec1,
    desc: 'Pink true wireless stereo earbuds with charging case'
  },
  {
    id: 'deal-17',
    name: '20W Power Bank',
    discount: '-25%',
    price: 1299,
    originalPrice: 1749,
    rating: 4.6,
    type: 'powerbank',
    image: elec2,
    desc: 'Pink 20W portable charger with built-in cables and display'
  },
  {
    id: 'deal-18',
    name: 'Portable Mini Fan',
    discount: '-40%',
    price: 499,
    originalPrice: 849,
    rating: 4.5,
    type: 'fan',
    image: elec3,
    desc: 'Purple handheld rechargeable mini cooling fan'
  },
  {
    id: 'deal-19',
    name: 'Cat Ear Headphones',
    discount: '-35%',
    price: 1899,
    originalPrice: 2899,
    rating: 4.8,
    type: 'headphones',
    image: elec4,
    desc: 'Pink wireless over-ear headphones with LED glowing cat ears'
  },
  {
    id: 'deal-20',
    name: 'Fitness Smartwatch',
    discount: '-50%',
    price: 999,
    originalPrice: 1999,
    rating: 4.4,
    type: 'smartwatch',
    image: elec5,
    desc: 'Light blue smart watch with health and fitness tracking'
  },
  {
    id: 'deal-21',
    name: 'Ocean Pearl Necklace',
    discount: '-30%',
    price: 899,
    originalPrice: 1299,
    rating: 4.8,
    type: 'necklace',
    image: jewel1,
    desc: 'Layered pearl and gold necklace with starfish and seashell charms'
  },
  {
    id: 'deal-22',
    name: 'Cowrie Shell Necklace',
    discount: '-25%',
    price: 699,
    originalPrice: 949,
    rating: 4.6,
    type: 'necklace',
    image: jewel2,
    desc: 'Layered cowrie shell and pearl beaded necklace set'
  },
  {
    id: 'deal-23',
    name: 'Sea Charms Bracelet',
    discount: '-40%',
    price: 499,
    originalPrice: 849,
    rating: 4.7,
    type: 'bracelet',
    image: jewel3,
    desc: 'Gold chain bracelet with cute starfish, turtle, and shell charms'
  },
  {
    id: 'deal-24',
    name: 'Stacked Shell Bracelets',
    discount: '-35%',
    price: 1199,
    originalPrice: 1849,
    rating: 4.9,
    type: 'bracelet',
    image: jewel4,
    desc: 'Set of four stacked gold bracelets with shells and pearls'
  },
  {
    id: 'deal-25',
    name: 'Reversible Octopus',
    discount: '-40%',
    price: 399,
    originalPrice: 699,
    rating: 4.8,
    type: 'plush',
    image: toy1,
    desc: 'Cute double-sided flip octopus plush toy'
  },
  {
    id: 'deal-26',
    name: 'Fluffy Bunny Keychain',
    discount: '-20%',
    price: 299,
    originalPrice: 399,
    rating: 4.7,
    type: 'toy',
    image: toy2,
    desc: 'Soft and fluffy white bunny plush keychain'
  },
  {
    id: 'deal-27',
    name: 'Strawberry Bunny',
    discount: '-30%',
    price: 799,
    originalPrice: 1199,
    rating: 4.9,
    type: 'plush',
    image: toy3,
    desc: 'Adorable white bunny hiding in a strawberry plush'
  },
  {
    id: 'deal-28',
    name: 'Classic Teddy Bear',
    discount: '-25%',
    price: 999,
    originalPrice: 1399,
    rating: 4.8,
    type: 'plush',
    image: toy4,
    desc: 'Soft and huggable light brown fluffy teddy bear'
  },
  {
    id: 'deal-29',
    name: 'Panda Night Light',
    discount: '-15%',
    price: 699,
    originalPrice: 849,
    rating: 4.6,
    type: 'nightlight',
    image: toy5,
    desc: 'Squishy silicone panda bedside lamp with soft glow'
  },
  {
    id: 'deal-30',
    name: 'Dino Mini Notebooks',
    discount: '-20%',
    price: 199,
    originalPrice: 249,
    rating: 4.8,
    type: 'notebook',
    image: stat1,
    desc: 'Set of cute dinosaur pocket spiral notebooks'
  },
  {
    id: 'deal-31',
    name: 'Fluffy Bear Diary',
    discount: '-30%',
    price: 499,
    originalPrice: 699,
    rating: 4.9,
    type: 'notebook',
    image: stat2,
    desc: 'Soft plush bear notebook with glasses cover'
  },
  {
    id: 'deal-32',
    name: 'Animal Gel Pens',
    discount: '-15%',
    price: 149,
    originalPrice: 199,
    rating: 4.7,
    type: 'pen',
    image: stat3,
    desc: 'Set of 4 cute animal character gel pens'
  },
  {
    id: 'deal-33',
    name: 'Pastel Mini Stapler',
    discount: '-25%',
    price: 199,
    originalPrice: 269,
    rating: 4.6,
    type: 'stapler',
    image: stat4,
    desc: 'Cute pastel mini stapler set with staples'
  },
  {
    id: 'deal-34',
    name: 'Bunny Spiral Notebook',
    discount: '-10%',
    price: 249,
    originalPrice: 299,
    rating: 4.8,
    type: 'notebook',
    image: stat5,
    desc: 'Cute bunny and grid pattern spiral notebook'
  },
  {
    id: 'deal-35',
    name: 'Pink Bow Pants',
    discount: '-30%',
    price: 1299,
    originalPrice: 1849,
    rating: 4.7,
    type: 'pants',
    image: fash1,
    desc: 'Trendy pink pants with cute bow details'
  },
  {
    id: 'deal-36',
    name: 'Red Bow Blouse',
    discount: '-25%',
    price: 1499,
    originalPrice: 1999,
    rating: 4.8,
    type: 'blouse',
    image: fash2,
    desc: 'Elegant white blouse featuring a large red bow'
  },
  {
    id: 'deal-37',
    name: 'Pink Bow Tee',
    discount: '-15%',
    price: 899,
    originalPrice: 1049,
    rating: 4.6,
    type: 'tee',
    image: fash3,
    desc: 'Oversized pink t-shirt with a white bow graphic'
  },
  {
    id: 'deal-38',
    name: 'Bow Graphic Outfit',
    discount: '-40%',
    price: 1999,
    originalPrice: 3349,
    rating: 4.9,
    type: 'outfit',
    image: fash4,
    desc: 'Matching set with black bow tee and pink cargo pants'
  },
  {
    id: 'deal-39',
    name: 'LED Light Bulbs',
    discount: '-20%',
    price: 299,
    originalPrice: 399,
    rating: 4.7,
    type: 'bulb',
    image: elec11,
    desc: 'Energy efficient white LED light bulbs pack'
  },
  {
    id: 'deal-40',
    name: 'Electrical Wire Rolls',
    discount: '-15%',
    price: 899,
    originalPrice: 1099,
    rating: 4.8,
    type: 'wire',
    image: elec12,
    desc: 'High quality colorful copper electrical cables'
  },
  {
    id: 'deal-41',
    name: 'CFL Light Bulbs',
    discount: '-25%',
    price: 349,
    originalPrice: 499,
    rating: 4.5,
    type: 'bulb',
    image: elec13,
    desc: 'Compact fluorescent light bulbs in various sizes'
  },
  {
    id: 'deal-42',
    name: 'Table Fan',
    discount: '-30%',
    price: 1299,
    originalPrice: 1899,
    rating: 4.6,
    type: 'fan',
    image: elec14,
    desc: 'Blue and white classic oscillating table fan'
  },
  {
    id: 'deal-43',
    name: 'Electric Steam Iron',
    discount: '-35%',
    price: 999,
    originalPrice: 1549,
    rating: 4.8,
    type: 'iron',
    image: elec15,
    desc: 'Blue electric steam iron with temperature control'
  }
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

