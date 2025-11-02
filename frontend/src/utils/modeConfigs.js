export const getModeConfig = (mode) => {
  const configs = {
    generic: {
      sliders: [], // Empty array - user adds sliders manually
    },
    musical: {
      sliders: [
        {
          id: 1,
          label: "🎸 Guitar",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[82, 1175]],
        },
        {
          id: 2,
          label: "🎹 Piano",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[27, 4186]],
        },
        {
          id: 3,
          label: "🥁 Drums",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [
            [50, 200],
            [2000, 5000],
          ],
        },
        {
          id: 4,
          label: "🎻 Violin",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[196, 3136]],
        },
      ],
    },
    animal: {
      sliders: [
        {
          id: 1,
          label: "🐕 Dog",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[500, 1000]],
        },
        {
          id: 2,
          label: "🐈 Cat",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[700, 1500]],
        },
        {
          id: 3,
          label: "🐦 Bird",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[2000, 8000]],
        },
        {
          id: 4,
          label: "🐄 Cow",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[150, 500]],
        },
      ],
    },
    human: {
      sliders: [
        {
          id: 1,
          label: "👨 Male Voice",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[85, 180]],
        },
        {
          id: 2,
          label: "👩 Female Voice",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[165, 255]],
        },
        {
          id: 3,
          label: "👴 Old Person",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[100, 200]],
        },
        {
          id: 4,
          label: "👦 Young Person",
          value: 1,
          min: 0,
          max: 2,
          freqRanges: [[200, 400]],
        },
      ],
    },
  };

  return configs[mode] || configs.generic;
};
