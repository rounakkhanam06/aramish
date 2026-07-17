import { create } from 'zustand';

// Import local assets for proper image display
import FashionImg from '../assets/products/product01.webp';
import JewelleryImg from '../assets/products/product02.webp';
import TshirtImg from '../assets/TopSection/TopSection2.webp';
import BeautyImg from '../assets/products/product04.webp';
import MakeupImg from '../assets/TopSection/TopSection1.webp';
import EarbudsImg from '../assets/products/product06.webp';
import SamsungImg from '../assets/products/product07.webp';
import ElectronicsImg from '../assets/products/product08.webp';
import SuitcaseImg from '../assets/products/product09.webp';
import FlipFlopsImg from '../assets/products/product10.webp';
import LipstickImg from '../assets/products/product11.webp';
import ShampooImg from '../assets/products/product12.webp';
import ToysImg from '../assets/products/product13.webp';
import StationeryImg from '../assets/products/product14.webp';
import GiftingImg from '../assets/products/product15.webp';

// Still Looking Section Assets
import StillImg1 from '../assets/StillSection/StillImages1.webp';
import StillImg2 from '../assets/StillSection/StillImages2.webp';
import StillImg3 from '../assets/StillSection/StillImages3.webp';
import StillImg4 from '../assets/StillSection/StillImages4.webp';
import StillImg5 from '../assets/StillSection/StillImages5.webp';

// Top Selection Section Assets
import TopImg1 from '../assets/TopSection/TopSection1.webp';
import TopImg2 from '../assets/TopSection/TopSection2.webp';
import TopImg3 from '../assets/TopSection/TopSection3.webp';
import TopImg4 from '../assets/TopSection/TopSection21.webp';

// Using local assets for products
const PRODUCT_IMAGES = {
  fashion: FashionImg,
  jewellery: JewelleryImg,
  tshirt: TshirtImg,
  lipstick: LipstickImg,
  shampoo: ShampooImg,
  makeup: MakeupImg,
  earbuds: EarbudsImg,
  phone: SamsungImg,
  electronics: ElectronicsImg,
  suitcase: SuitcaseImg,
  shoes: FlipFlopsImg,
  beauty: BeautyImg,
  toys: ToysImg,
  stationery: StationeryImg,
  gifting: GiftingImg,
};

const useVendorStore = create((set) => ({
  selectedCategory: 'For You',
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  
  // Header visibility state
  isSaleBannerVisible: true,
  setSaleBannerVisible: (visible) => set({ isSaleBannerVisible: visible }),

  // Home Page Sections Data
  homeSections: {
    stillLooking: [
      { label: 'Co-ords', img: StillImg1, link: '/vendor/products' },
      { label: 'Necklaces', img: StillImg2, link: '/vendor/products' },
      { label: "Women's Tops", img: StillImg3, link: '/vendor/products' },
      { label: 'Lipsticks', img: StillImg4, link: '/vendor/products' }
    ],
    topSelection: [
      { name: 'Biotique Face Wash', tag: 'Grab Or Gone', img: TopImg1, link: '/vendor/product-detail' },
      { name: 'Lakmé Moisturizer', tag: 'Best Picks', img: TopImg2, link: '/vendor/product-detail' },
      { name: 'Vaseline Lip Balm', tag: 'Popular', img: TopImg3, link: '/vendor/product-detail' },
      { name: 'MARS Lipstick', tag: 'Widest Range', img: TopImg4, link: '/vendor/product-detail' }
    ],
    brandsSpotlight: [
      { title: 'Flat 73% off', sub: 'Limited time deal', img: PRODUCT_IMAGES.earbuds, link: '/vendor/product-detail' },
      { title: 'Shop now', sub: 'Blend easily', img: PRODUCT_IMAGES.makeup, link: '/vendor/product-detail' },
      { title: 'Coming to India', sub: 'CMF Watch 3 Pro', img: PRODUCT_IMAGES.phone, link: '/vendor/product-detail' },
      { title: 'Just ₹599', sub: 'Lowest price ever', img: PRODUCT_IMAGES.shampoo, link: '/vendor/product-detail' }
    ],
    bestQuality: [
      { name: "GUTI Women's Jeans", tag: 'Grab Or Gone', img: PRODUCT_IMAGES.fashion, link: '/vendor/product-detail' },
      { name: "Mandarin Women's Shirts", tag: 'Popular', img: TopImg2, link: '/vendor/product-detail' },
      { name: 'Royatto Necklaces', tag: 'Popular', img: PRODUCT_IMAGES.jewellery, link: '/vendor/product-detail' },
      { name: "Sqew Women's Trousers", tag: 'In Focus Now', img: PRODUCT_IMAGES.shoes, link: '/vendor/product-detail' }
    ],
    keepShopping: [
      { label: 'Suitcases', img: TopImg3, link: '/vendor/products' },
      { label: 'Smartphones', img: TopImg1, link: '/vendor/products' },
      { label: 'Electronics', img: PRODUCT_IMAGES.electronics, link: '/vendor/products' },
      { label: 'Beauty', img: TopImg4, link: '/vendor/products' }
    ]
  },
  
  setHomeSections: (newSections) => set((state) => ({
    homeSections: { ...state.homeSections, ...newSections }
  }))
}));

export default useVendorStore;
