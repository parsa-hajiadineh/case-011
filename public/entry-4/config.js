// Supply authored content here. Null values intentionally block access or note reveals.
// correctOption is a one-based option number (1, 2, or 3), never a default answer.
// Every image test needs a nonempty question, three nonempty labels, three loaded
// images, and a correctOption before it can accept an answer.
export const entry4Config = {
  imageTests: [
    {
      question: null,
      options: [
        { image: "assets/tests/test-1-option-1.png", label: null },
        { image: "assets/tests/test-1-option-2.png", label: null },
        { image: "assets/tests/test-1-option-3.png", label: null }
      ],
      correctOption: null
    },
    {
      question: null,
      options: [
        { image: "assets/tests/test-2-option-1.png", label: null },
        { image: "assets/tests/test-2-option-2.png", label: null },
        { image: "assets/tests/test-2-option-3.png", label: null }
      ],
      correctOption: null
    }
  ],
  // Index 0 is Evidence 1, index 6 is Evidence 7. Each row contains notes 1–3.
  evidenceNotes: [
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ]
};
