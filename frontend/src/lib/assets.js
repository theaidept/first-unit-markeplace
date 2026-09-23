const PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
  "<rect width='400' height='400' fill='#0b1f42'/>" +
  "<rect width='400' height='400' fill='url(#g)'/>" +
  "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='#16305c'/><stop offset='1' stop-color='#0d1424'/></linearGradient></defs>" +
  "<text x='50%' y='50%' fill='#c9a24a' font-family='Oswald,Arial' font-size='30' font-weight='700' " +
  "letter-spacing='3' text-anchor='middle' dominant-baseline='middle'>FIRST UNIT</text></svg>"
);
export const PLACEHOLDER_IMG = PLACEHOLDER;
export const imgFallback = (e) => {
  if (e.currentTarget.dataset.fb) return;
  e.currentTarget.dataset.fb = "1";
  e.currentTarget.src = PLACEHOLDER;
};

export const IMG = {  heroGroup:
    "https://static.prod-images.emergentagent.com/jobs/77f9cf0f-d6ac-4fc8-9cd5-77c8080c4b26/images/128b4a12bbf53ed9e1be3ae93f9d2b15c02e06088949957d0efd2238b5affc03.jpeg",
  heroGear:
    "https://static.prod-images.emergentagent.com/jobs/77f9cf0f-d6ac-4fc8-9cd5-77c8080c4b26/images/effc81ad2767a7db46a16a22d9aab36e5ca2835bb653c506af955fd9e3d64d91.jpeg",
  verifySide:
    "https://static.prod-images.emergentagent.com/jobs/77f9cf0f-d6ac-4fc8-9cd5-77c8080c4b26/images/1e4b6be6b946666c54fd549a548ece07964fcba462d0a285dd3b292e08dc794f.jpeg",
};

// Shoppable-story thumbnails (institutional product shots, unified by a navy overlay in CSS).
export const STORY_IMG = {
  "Duty Belt Set":
    "https://images.pexels.com/photos/7714764/pexels-photo-7714764.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "Academy Ring":
    "https://images.unsplash.com/photo-1705326455036-0fab8ecba04d?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
  "Station Art Print":
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
  "'19 Rescue Truck":
    "https://images.unsplash.com/photo-1637590110484-03778d227a0d?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
  "Medic Bag — Full":
    "https://images.unsplash.com/photo-1624638760852-8ede1666ab07?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
  "Dispatch Headset":
    "https://images.unsplash.com/photo-1607524219458-c5849519805f?crop=entropy&cs=srgb&fm=jpg&q=85&w=640",
};
