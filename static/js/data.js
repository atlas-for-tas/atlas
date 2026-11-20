// All page content lives here. Edit this file, not index.html.
window.SITE = {
  // Set to false for the camera-ready project page. While true, nothing in
  // `authors`, `links`, `abstract` or `bibtex` is shown -- but it still ships
  // in this file, so leave those fields EMPTY until the paper is de-anonymized.
  anonymous: false,

  title: 'Tracking Objects Through Assembly and Decomposition',
  teaser: {
    video: 'ours/crackers_animated',
    text: 'Given an input video (top-left), Atlas recovers the tracks of all objects participating in transformations (top-right) and constructs a state graph (bottom).',
  },

  // Camera-ready only.
  // `affiliations` on an author indexes into the list below (1-based); leave it out when
  // everyone shares a single affiliation, which is then shown once without numbers.
  authors: [
    { name: 'Cheryl Lam', url: 'https://www.linkedin.com/in/ch3ryllam/' },
    { name: 'Yihong Sun', url: 'https://yihongsun.github.io' },
    { name: 'Bharath Hariharan', url: 'https://www.cs.cornell.edu/~bharathh/' },
  ],
  affiliations: [
    'Cornell University',
  ],
  // `icon` is a Font Awesome 5 (fas/fab) or Academicons (ai) class. A link without a `url`
  // looks the same as the others but can't be clicked (e.g. "coming soon").
  links: [
    { label: 'Paper', icon: 'fas fa-file-pdf', url: 'https://arxiv.org/pdf/2611.26269' },
    { label: 'arXiv', icon: 'ai ai-arxiv', url: 'https://arxiv.org/abs/2611.26269' },
    { label: 'Code', icon: 'fab fa-github', url: 'https://github.com/ch3ryllam/Atlas' },
    { label: 'Data', icon: 'fas fa-database', url: 'https://huggingface.co/datasets/ch3ryllam/OmniST' },
  ],
  // HTML.
  abstract: 'Tracking objects through transformations is essential for understanding real-world dynamics. Recent work has extended traditional object tracking to detect state changes. However, existing methods require an initial object prompt and detect only its decompositions, missing assembly events, which begin with multiple objects rather than one. We therefore introduce a prompt-free formulation of this task, where the goal is to recover all object tracks and detect both decomposition and assembly events given only a video. Our key insight is that assembly is decomposition in reverse. Building on this insight, we present <strong>Atlas</strong>, a zero-shot system that constructs and jointly reasons over forward and reverse spatiotemporal partitions to recover object tracks and their transformations. We further introduce OmniST, a benchmark with dense annotations of objects and both transformation types. On OmniST, Atlas recovers more than twice as many state changes as prior methods while remaining competitive on existing benchmarks that only evaluate decomposition.',
  bibtex: 'Coming soon!',

  // Methodology walkthrough. `video` (or `videos`, shown one above the other) is relative to static/results without extension.
  method: {
    id: 'crackers',
    intro: 'We illustrate each stage of Atlas on a single example, in which a plastic bag is taken out of a cracker box, crackers are poured out of the bag, and the bag is later put back into the box.',
    steps: [
      {
        title: '1. Produce bidirectional spatiotemporal partitions',
        videos: ['method/crackers_partition_forward', 'method/crackers_partition_reverse'],
        text: 'First, Atlas computes forward and reverse spatiotemporal partitions of the video. For each direction we show the initial tubelets (present from the start of tracking) and the emerging tubelets. Since reverse tracking starts from the last frame, the reverse tracking video (bottom) is played backward.',
      },
      {
        title: '2. Detect state changes',
        videos: ['method/crackers_emergence_matching_decomposition_F_9', 'method/crackers_emergence_matching_decomposition_F_11', 'method/crackers_emergence_matching_assembly_R_11'],
        labels: ['Decomposition (frame 62)', 'Decomposition (frame 190)', 'Assembly (frame 394)'],
        layout: 'tabs',
        text: 'Second, Atlas jointly reasons over both partitions to identify candidate transformations: a decomposition is detected from a tubelet that newly emerges in forward tracking, and an assembly from a tubelet that newly emerges in reverse tracking (see Sec. 3.4 for the definition of <em>matches</em>). Atlas then uses a VLM to verify each candidate transformation, refine its timing, and generate a natural-language description.',
      },
      {
        title: '3. Finalize pool of tubelets',
        video: 'ours/crackers_animated',
        text: 'Finally, Atlas matches all forward tubelets against all reverse tubelets by IoU and merges matched pairs, yielding a final, unified set of tubelets that forms our spatiotemporal partition of the whole video, and outputs a state graph. For visualization, we isolate the objects participating in transformations.',
      },
    ],
  },

  methods: [
    { key: 'sam3', label: 'GPT-4.1 + SAM3' },
    { key: 'tubeletgraph_bidir', label: 'TubeletGraph-Bidir' },
    { key: 'ours', label: 'Atlas (Ours)' },
  ],

  categories: [
    { key: 'mixed', label: 'Mixed' },
    { key: 'assembly', label: 'Assembly' },
    { key: 'decomposition', label: 'Decomposition' },
  ],

  // `id` is the file name stem in static/results/<method>/<id>_animated.mp4.
  // `note` (optional) is shown above the comparison row: say what to look for.
  examples: [
    { id: 'put_pear_in_jar', category: 'assembly' },
    { id: 'FoVtnbm0hPc_0', category: 'assembly' },
    { id: 'assemble_dyson', category: 'assembly' },
    { id: 'clean_up_desk', category: 'assembly' },

    { id: '0013_break_brocolli_4', category: 'decomposition' },
    { id: 'cut_butternut_squash', category: 'decomposition' },
    { id: 'split_paper', category: 'decomposition' },
    { id: 'unbox_zyrtec', category: 'decomposition' },

    { id: 'crackers', category: 'mixed' },
    { id: '0004_open_cup_6', category: 'mixed' },
    { id: 'toothbrush', category: 'mixed' },
    { id: '0KDMdYww4VE', category: 'mixed' },
    { id: 'picture_frame', category: 'mixed' },
    { id: 'swap_earbuds', category: 'mixed' },
    { id: 'iclicker_2', category: 'mixed' },
    { id: 'puzzle', category: 'mixed' },
    { id: 'playdoh', category: 'mixed' },
    { id: 'i7rKCchfD2s', category: 'mixed' },
  ],

  failures: [
    {
      id: 'peel_shrimp',
      compact: true,
      intro: 'Atlas relies on reliable false negatives from the base tracker (SAM2.1) to detect transformations, as new tubelets emerge only when existing tracks fail to cover an object. If SAM2.1 instead propagates a mask through a transformation, no new tubelet emerges, causing the transformation to be missed.',
      text: 'SAM2.1 propagates a single track over the shrimp in the forward direction, so Atlas misses decompositions at t=3s and t=7s.',
      videos: [
        { label: 'Forward Partition', file: 'failure_cases/peel_shrimp_sam2_propagated', full: true },
        { label: 'Predictions', file: 'failure_cases/peel_shrimp_animated', full: true },
      ],
    },
    {
      id: 'train_tracks',
      compact: true,
      text: 'In the reverse tracking direction, SAM2.1 propagates a single mask that covers every train track even after they separate. In the forward tracking direction, no tubelets emerge either. Therefore, all five transformations are missed (t=2s, 5s, 7s, 10s, 13s).',
      equalPanels: true,
      videos: [
        { label: 'Forward Partition', file: 'failure_cases/train_tracks_partition_forward' },
        { label: 'Reverse Partition', file: 'failure_cases/train_tracks_partition_reverse' },
        { label: 'Predictions', file: 'failure_cases/train_tracks_animated', full: true },
      ],
    },
    {
      id: 'peel_orange',
      intro: 'Atlas also relies on the VLM to verify candidate transformations and align them in time, making the VLM a second source of error.',
      equalPanels: true,
      text: 'Temporal realignment corrects the first decomposition, which was initially predicted late. However, the VLM realigns the second decomposition too early, to t=2s, onto the first orange slice being pulled off.',
      videos: [
        { label: 'Before Realignment', file: 'failure_cases/peel_orange_before_realignment_animated' },
        { label: 'After Realignment', file: 'failure_cases/peel_orange_after_realignment_animated' },
      ],
    },
  ],
};
