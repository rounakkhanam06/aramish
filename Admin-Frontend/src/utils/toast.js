import toast from 'react-hot-toast';

// react-hot-toast doesn't have toast.info natively, so we add it
if (!toast.info) {
  toast.info = (msg, options) => toast(msg, { icon: 'ℹ️', ...options });
}

export default toast;
