import { create } from 'zustand';

const useDeliveryStore = create((set) => ({
  profile: {
    fullName: 'Chirag',
    mobile: '+91 98765 43210',
    altMobile: '',
    email: 'chirag@example.com',
    dob: '1998-05-12',
    age: '26',
    fathersName: 'Mr. Singh',
    currAddress: 'South Delhi, New Delhi',
    permAddress: 'South Delhi, New Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    pinCode: '110001',
    emergencyContact: '+91 98765 43211',
    aadhaar: '1234-5678-9012',
    pan: 'ABCDE1234F',
    policeVerification: 'Yes',
    vehicleType: 'Bike',
    vehicleNumber: 'DL 01 AB 1234',
    licenseNumber: 'DL1420110012345',
    rcNumber: 'RC123456789',
    insuranceNumber: 'INS123456789',
    insuranceExpiry: '2025-12-31',
    bankName: 'HDFC Bank',
    accHolder: 'Chirag',
    accNumber: '50100123456789',
    ifsc: 'HDFC0000123',
    branch: 'Connaught Place',
    upiId: 'chirag@okaxis',
    // Documents (Base64 or URL)
    profilePhoto: null,
    idCard: null,
    educationMarksheet: null,
    drivingLicenseDoc: null,
    applicantSignature: null
  },

  updateProfile: (newData) => set((state) => ({
    profile: { ...state.profile, ...newData }
  }))
}));

export default useDeliveryStore;
