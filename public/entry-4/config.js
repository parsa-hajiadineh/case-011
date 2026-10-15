// User-authorized provisional testing copy; replace with authored notes later.
const provisionalNotes = [
  "مدارک این مرحله را یکبار دیگر با دقت مرور کنید.",
  "جزئیات را کنار هم قرار دهید ممکن است نکتهای در مقایسه آنها روشن شود.",
  "پیش از ادامه مطمئن شوید برداشتتان با همه اطلاعات این مرحله سازگار است."
];

// correctOption is the one-based option number in DOM order (right to left on desktop).
// The first option in each test is explicitly correct for this testing setup.
export const entry4Config = {
  imageTests: [
    {
      question: "میوه مورد علاقه مادرم کدام است",
      options: [
        { image: "assets/tests/test-1-option-1.png", label: "تصویر ۱" },
        { image: "assets/tests/test-1-option-2.png", label: "تصویر ۲" },
        { image: "assets/tests/test-1-option-3.png", label: "تصویر ۳" }
      ],
      correctOption: 1
    },
    {
      question: "کدام تصویر انتخاب پدرم است",
      options: [
        { image: "assets/tests/test-2-option-1.png", label: "تصویر ۱" },
        { image: "assets/tests/test-2-option-2.png", label: "تصویر ۲" },
        { image: "assets/tests/test-2-option-3.png", label: "تصویر ۳" }
      ],
      correctOption: 1
    }
  ],
  // Index 0 is Evidence 1, index 6 is Evidence 7. Each row contains notes 1–3.
  evidenceNotes: Array.from({ length: 7 }, () => [...provisionalNotes])
};
