const BASE_URL = 'http://10.0.2.2:5001';
const getImageUrl = (path) => {
  if (!path || typeof path !== 'string') return null;
  
  path = path.replace(/\\/g, '/');

  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (path.includes('localhost') || path.includes('10.0.2.2') || path.includes('127.0.0.1')) {
      const idx = path.indexOf('/uploads/');
      if (idx !== -1) {
        return `${BASE_URL}${path.substring(idx)}`;
      }
    }
    return path;
  }
  
  const uploadsIndex = path.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    path = path.substring(uploadsIndex);
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
};

console.log(getImageUrl('/uploads/profile/xyz.jpg'));
console.log(getImageUrl('uploads/profile/xyz.jpg'));
console.log(getImageUrl('https://res.cloudinary.com/foo.jpg'));
console.log(getImageUrl('/../https:/res.cloudinary.com/foo.jpg'));
