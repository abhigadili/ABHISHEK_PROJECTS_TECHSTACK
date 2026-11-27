/** Healthcare banners shipped in /public/images (static assets). One is picked deterministically per hospital id. */
const BANNERS = ['/images/hospital-1.jpg', '/images/hospital-2.jpg', '/images/hospital-3.jpg'] as const;
export const hospitalBanner = (id: number) => BANNERS[Math.abs(id) % BANNERS.length];
