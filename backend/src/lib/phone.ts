/** Normalise any phone format to digits only: "+91 98765-43210" -> "919876543210". */
export const digitsOnly = (phone: string) => phone.replace(/\D/g, "");
