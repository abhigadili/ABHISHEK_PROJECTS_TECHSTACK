import type { MetadataRoute } from 'next';
/** Web app manifest (served at /manifest.webmanifest) — lets users install EMS as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'EMS — Employee Management System', short_name: 'EMS', description: 'Employee directory, attendance, leave and HR reports.', start_url: '/dashboard', display: 'standalone', background_color: '#f5f7fb', theme_color: '#1d4ed8', icons: [{ src: '/icon', sizes: '64x64', type: 'image/png' }, { src: '/apple-icon', sizes: '180x180', type: 'image/png' }] };
}
