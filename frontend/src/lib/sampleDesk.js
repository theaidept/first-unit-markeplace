export const SAMPLE_LISTINGS = [
  { id: "sample-l1", title: "Turnout Gear — Size L", price: 240, status: "live", location: "Austin, TX", views: 48, created_at: "2026-10-12T10:00:00", photos: [], featured: true, sample: true },
  { id: "sample-l2", title: "Duty Belt Set", price: 89, status: "live", location: "Austin, TX", views: 22, created_at: "2026-10-10T10:00:00", photos: [], sample: true },
  { id: "sample-l3", title: "Patrol Flashlight", price: 48, status: "sold", location: "Round Rock, TX", views: 61, created_at: "2026-09-28T10:00:00", photos: [], sample: true },
];

export const SAMPLE_OFFERS = [
  { id: "sample-o1", direction: "received", amount: 210, status: "pending", sample: true, listing: { title: "Turnout Gear — Size L", price: 240, photos: [] }, buyer: { display_handle: "Engine 14", verified_badge: true } },
  { id: "sample-o2", direction: "sent", amount: 110, status: "pending", sample: true, listing: { title: "Patrol Duty Bag 40L", price: 129, photos: [], seller: { display_handle: "Austin PD", verified_badge: true } } },
];

export const SAMPLE_ORDERS = [
  { id: "sample-t1", role: "seller", agreed_amount: 64, status: "agreed", sample: true, listing: { title: "Tactical Duty Belt", photo: null }, counterparty: { display_handle: "Station 9 EMS" } },
  { id: "sample-t2", role: "buyer", agreed_amount: 48, status: "completed", sample: true, listing: { title: "LED Patrol Flashlight", photo: null }, counterparty: { display_handle: "PD Unit 22" }, pay_targets: [{ method: "paypal", label: "PayPal", handle: "pdunit22", url: "#" }] },
];

export const SAMPLE_VENDORS = [
  { id: "sample-v1", name: "Austin Fleet Supply", contact: "sales@austinfleet.example", fee_amount: 49, active: true, sample: true },
  { id: "sample-v2", name: "Lone Star Duty Shop", contact: "hello@lonestarduty.example", fee_amount: 29, active: true, sample: true },
  { id: "sample-v3", name: "Central Texas Outfitters", contact: "512-555-0144", fee_amount: 0, active: false, sample: true },
];

export const SAMPLE_THREADS = [
  { id: "sample-th1", sample: true, unread_count: 1, last_message: "Can you do $200 even?", last_message_at: "2026-10-14T16:40:00", other: { display_handle: "Engine 14", initials: "E1", verified_badge: true }, listing: { title: "Turnout Gear — Size L" } },
  { id: "sample-th2", sample: true, unread_count: 0, last_message: "Meetup at the station lot works.", last_message_at: "2026-10-13T09:12:00", other: { display_handle: "Dispatch 4", initials: "D4", verified_badge: true }, listing: { title: "Duty Belt Set" } },
];

export const SAMPLE_MESSAGES = {
  "sample-th1": [
    { id: "sm1", mine: false, body: "Turnout gear still listed?", created_at: "2026-10-14T16:32:00" },
    { id: "sm2", mine: true, body: "Yes — size L, one season, washed and hung.", created_at: "2026-10-14T16:36:00" },
    { id: "sm3", mine: false, body: "Can you do $200 even?", created_at: "2026-10-14T16:40:00" },
    { id: "sm4", mine: true, body: "Barely used — $220 is as low as I can go.", created_at: "2026-10-14T16:48:00" },
  ],
  "sample-th2": [
    { id: "sm5", mine: true, body: "Duty belt still available?", created_at: "2026-10-13T08:55:00" },
    { id: "sm6", mine: false, body: "Meetup at the station lot works.", created_at: "2026-10-13T09:12:00" },
  ],
};

const I = {
  tools: "https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1080",
  wallet: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1080&q=80",
  belt: "https://images.pexels.com/photos/7714764/pexels-photo-7714764.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1080",
  pack: "https://images.pexels.com/photos/8942498/pexels-photo-8942498.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1080",
  pants: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1080&q=80",
  fire: "https://images.pexels.com/photos/280076/pexels-photo-280076.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1920&w=1080",
  turnout: "https://images.unsplash.com/photo-1637590110484-03778d227a0d?auto=format&fit=crop&w=1080&q=80",
  helmet: "https://images.pexels.com/photos/5965214/pexels-photo-5965214.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1920&w=1080",
  patch: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=1080&q=80",
  boots: "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=1080&q=80",
  shoes: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1080&q=80",
};

/** Demo ads sized for each placement. Looks like real first-responder brands. */
export const SAMPLE_ADS = [
  { id: "sample-ad-otis", sample: true, seed_key: "otis-feed", placement: "feed", frequency: 4, ad_type: "product", advertiser: "OTIS", headline: "Smart Gun Care Kit", price: "$59", image: I.tools, cta: "Shop now", short_line: "Clean. Lubricate. Protect.", link_url: "https://otistec.com" },
  { id: "sample-ad-nexbelt", sample: true, seed_key: "nexbelt-feed", placement: "feed", frequency: 3, ad_type: "product", advertiser: "Nexbelt", headline: "Titan PreciseFit Duty Belt", price: "$68", image: I.belt, cta: "Shop now", short_line: "The belt with no holes.", link_url: "https://nexbelt.com" },
  { id: "sample-ad-perfectfit", sample: true, seed_key: "perfectfit-feed", placement: "feed", frequency: 5, ad_type: "product", advertiser: "Perfect Fit", headline: "Shield Wallet", price: "$42", image: I.wallet, cta: "Shop now", short_line: "Badge, ID, and cards. One slim wallet.", link_url: "https://perfectfit.com" },
  { id: "sample-ad-rit", sample: true, seed_key: "rit-feed", placement: "feed", frequency: 4, ad_type: "product", advertiser: "RIT Safety Solutions", headline: "Rapid Intervention Pack", price: "$189", image: I.pack, cta: "Shop now", short_line: "Grab-and-go kit for the mayday.", link_url: "https://ritsafetysolutions.com" },
  { id: "sample-ad-propper-feed", sample: true, seed_key: "propper-feed", placement: "feed", frequency: 6, ad_type: "product", advertiser: "Propper", headline: "TAC.U Combat Pant", price: "$54", image: I.pants, cta: "Shop now", short_line: "Uniform pants built for the shift.", link_url: "https://www.propper.com" },
  { id: "sample-ad-majfire", sample: true, seed_key: "majfire-story", placement: "story", frequency: 3, ad_type: "product", advertiser: "Majfire", headline: "Composite Fire Helmet", price: "$310", image: I.helmet, cta: "Shop now", short_line: "Lightweight shell, full brim.", link_url: "https://majfire.com" },
  { id: "sample-ad-lakeland-story", sample: true, seed_key: "lakeland-story", placement: "story", frequency: 3, ad_type: "brand", advertiser: "Lakeland", headline: "Protect Your People", price: "", image: I.fire, cta: "Visit site", short_line: "Turnout gear for the line.", link_url: "https://www.lakeland.com" },
  { id: "sample-ad-propper-story", sample: true, seed_key: "propper-story", placement: "story", frequency: 4, ad_type: "product", advertiser: "Propper", headline: "Duty Uniform Package", price: "$96", image: I.turnout, cta: "Shop now", short_line: "Shift-ready from the first call.", link_url: "https://www.propper.com" },
  { id: "sample-ad-lakeland-cat", sample: true, seed_key: "lakeland-cat", placement: "category", category_slug: "gear", frequency: 1, ad_type: "brand", advertiser: "Lakeland", headline: "Lakeland Turnout", price: "", image: I.turnout, cta: "Shop gear", short_line: "Protect your people.", link_url: "https://www.lakeland.com" },
  { id: "sample-ad-premier", sample: true, seed_key: "premier-cat", placement: "category", category_slug: "art", frequency: 1, ad_type: "product", advertiser: "Premier Emblem & Insignia", headline: "Department Patch Set", price: "$28", image: I.patch, cta: "Shop now", short_line: "Custom emblems for the house.", link_url: "https://premieremblem.com" },
  { id: "sample-ad-otis-cat", sample: true, seed_key: "otis-cat", placement: "category", category_slug: "gear", frequency: 1, ad_type: "product", advertiser: "OTIS", headline: "Ripcord Bore Cleaner", price: "$18", image: I.tools, cta: "Shop now", short_line: "Pull-through clean after every range day.", link_url: "https://otistec.com" },
  { id: "sample-ad-rocky", sample: true, seed_key: "rocky-search", placement: "search", keywords: "boots, footwear, shoes, rocky", frequency: 1, ad_type: "product", advertiser: "Rocky", headline: "S2V Tactical Boot", price: "$165", image: I.boots, cta: "Shop now", short_line: "Side-zip boot for the street and the trail.", link_url: "https://www.rockyboots.com" },
  { id: "sample-ad-reebok", sample: true, seed_key: "reebok-search", placement: "search", keywords: "boots, shoes, training, reebok", frequency: 1, ad_type: "product", advertiser: "Reebok", headline: "Nano X Training Shoe", price: "$130", image: I.shoes, cta: "Shop now", short_line: "Gym to roll-call. Built to train.", link_url: "https://www.reebok.com" },
];

export const SAMPLE_FEED_ADS = SAMPLE_ADS.filter((a) => a.placement === "feed");
