import fs from 'fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const createSectionHeading = (text, level = HeadingLevel.HEADING_1) => {
    return new Paragraph({
        text: text,
        heading: level,
        spacing: { before: 400, after: 200 }
    });
};

const createParagraph = (text) => {
    return new Paragraph({
        children: [new TextRun(text)],
        spacing: { after: 120 }
    });
};

const createBullet = (text) => {
    return new Paragraph({
        children: [new TextRun(text)],
        bullet: { level: 0 },
        spacing: { after: 120 }
    });
};

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "Functional Requirements Document (FRD)",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: "Project: Aramish E-Commerce Application",
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),

            createSectionHeading("1. Introduction"),
            createParagraph("The purpose of this document is to outline the functional requirements for the Aramish E-Commerce Application. This system is a modern, gamified e-commerce platform built with React, focusing on a rich user experience, dynamic interactions, and comprehensive shopping features."),

            createSectionHeading("2. System Overview"),
            createParagraph("The application is currently developed as a Single Page Application (SPA) using the following frontend technologies:"),
            createBullet("React 19 for building user interfaces"),
            createBullet("Vite for fast build tooling and development"),
            createBullet("Tailwind CSS for responsive and utility-first styling"),
            createBullet("Framer Motion for rich component animations and transitions"),
            createBullet("Lottie React for rendering complex vector animations"),
            createBullet("React Router DOM for seamless client-side routing"),

            createSectionHeading("3. User Roles"),
            createBullet("Guest User: Can browse products, view categories, and add items to cart, but must log in to checkout, view orders, or access wishlist."),
            createBullet("Authenticated User: Has full access to profile management, order tracking, gamification features, wallet, and checkout flows."),

            createSectionHeading("4. Functional Requirements"),
            
            createSectionHeading("4.1 Splash Screen", HeadingLevel.HEADING_2),
            createBullet("The application shall display an animated splash screen (video-based) on initial load."),
            createBullet("The splash screen shall automatically dismiss and transition into the main application layout seamlessly."),

            createSectionHeading("4.2 Product Discovery & Browsing", HeadingLevel.HEADING_2),
            createBullet("Home Page: Shall display promotional banners, top categories, and featured products."),
            createBullet("Categories: Shall allow users to browse products by specific categories or departments."),
            createBullet("Top Selection & Crazy Deals: Shall highlight highly-rated products and ongoing discounts."),
            createBullet("Studio Page: Shall provide curated lifestyle content, fashion feeds, or lookbooks (Studio feature)."),
            createBullet("Product Details: Shall display product images, pricing, descriptions, reviews, and a 'Similar Products' section."),

            createSectionHeading("4.3 Shopping Cart & Checkout", HeadingLevel.HEADING_2),
            createBullet("Cart: Shall allow users to add/remove products, adjust quantities, and view a price breakdown."),
            createBullet("Checkout: Shall process the user's order, capturing shipping details, applying coupons, and selecting payment methods."),
            createBullet("Review Order: Shall allow users to review their final order summary before final submission."),

            createSectionHeading("4.4 User Profile & Account Management", HeadingLevel.HEADING_2),
            createBullet("Authentication: Shall allow users to log in or register securely."),
            createBullet("Profile: Shall allow users to view and edit personal information, avatars, and preferences."),
            createBullet("Saved Addresses: Shall allow users to manage multiple delivery addresses."),
            createBullet("Security & Settings: Shall allow users to configure account security and application settings."),

            createSectionHeading("4.5 Order Management", HeadingLevel.HEADING_2),
            createBullet("Orders Page: Shall display a history of the user's past and current orders."),
            createBullet("Order Details: Shall provide a detailed receipt, including itemized lists and total costs."),
            createBullet("Track Order: Shall provide real-time or status-based tracking updates for an active order."),

            createSectionHeading("4.6 Engagement & Gamification", HeadingLevel.HEADING_2),
            createBullet("Games Page: Shall include interactive games (like Quizzes) to keep users engaged and potentially earn rewards."),
            createBullet("Wishlist: Shall allow users to save products for future consideration."),
            createBullet("Coupons & Offers: Shall allow users to view and apply available discount codes."),
            createBullet("Wallet: Shall allow users to view and manage store credits or digital wallet balances."),
            createBullet("Refer & Earn: Shall provide a referral system for users to invite friends and earn rewards."),

            createSectionHeading("4.7 Help & Support", HeadingLevel.HEADING_2),
            createBullet("Help Center: Shall provide FAQs, contact methods, and customer support resources."),

            createSectionHeading("5. Non-Functional Requirements"),
            createBullet("Responsiveness: The UI shall be fully responsive across mobile, tablet, and desktop viewports."),
            createBullet("Performance: Pages shall load quickly with optimized assets and lazy loading where applicable."),
            createBullet("UX/UI: The application shall incorporate smooth transitions, micro-interactions, and visual feedback using Framer Motion and Lottie."),
            createBullet("Accessibility: Interactive elements should be easily reachable and provide appropriate feedback.")
        ]
    }]
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("Aramish_FRD.docx", buffer);
    console.log("Document created successfully as Aramish_FRD.docx");
});
