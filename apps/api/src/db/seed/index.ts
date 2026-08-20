import { memoryStore } from '../store.js';

export async function seedInitialData() {
  console.log('Showroom database initialized with Flagship profile, Staff users, Daily gold rates & Showroom inventory.');
  return memoryStore;
}
