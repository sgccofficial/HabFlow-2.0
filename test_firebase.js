import { initializeApp } from 'firebase/app';
// We don't have real credentials, but we can see what JSON stringify does.
const h = { id: '1', isFrozen: false, frozenSince: null, frozenDates: [] };
const cleanData = JSON.parse(JSON.stringify(h));
console.log(cleanData);
