const baseRequestOptions: RequestInit = {
  mode: 'cors',
  referrer: location.origin,
  referrerPolicy: 'strict-origin-when-cross-origin',
};

export default baseRequestOptions;
