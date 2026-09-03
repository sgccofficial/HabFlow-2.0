const localState = {
  habits: [
    {
      id: "1",
      name: "Habit 1",
      isFrozen: false,
      frozenSince: null,
      frozenDates: []
    }
  ]
};

const str = JSON.stringify(localState.habits);
console.log("Local string:", str);

// Simulate Firebase save and retrieve (keys might be reordered)
const firebaseData = {
  habits: [
    {
      frozenDates: [],
      frozenSince: null,
      id: "1",
      isFrozen: false,
      name: "Habit 1"
    }
  ]
};

const strFirebase = JSON.stringify(firebaseData.habits);
console.log("Firebase string:", strFirebase);

console.log("Are they equal?", str === strFirebase);
