export function reviewInput(input) {
  if (!input || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw Error('Choose a rating from 1 to 5.');
  if (typeof input.message !== 'string' || input.message.trim().length < 10 || input.message.length > 4000 || /[\u0000-\u0008]/.test(input.message)) throw Error('Write a review between 10 and 4,000 characters.');
  if (typeof input.name !== 'string' || input.name.length > 100 || /[\u0000-\u001f]/.test(input.name)) throw Error('Display name must be 100 characters or fewer.');
  if (typeof input.submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.submissionId)) throw Error('Invalid review submission.');
  return {type: 'review', rating: input.rating, message: input.message.trim(), name: input.name.trim(), publishConsent: input.publishConsent === true, submissionId: input.submissionId};
}
