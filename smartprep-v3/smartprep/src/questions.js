// ============================================================
//  SmartPrep — Questions Database
// ============================================================
const QUESTIONS = {
  DSA: [
    { text: "Explain the difference between a stack and a queue. When would you use each one?", difficulty: "Easy", keywords: ["LIFO", "FIFO", "stack", "queue", "push", "pop", "enqueue", "dequeue"], hint: "Think real-world analogies — a stack of plates vs a queue at a bank." },
    { text: "What is the time complexity of binary search and why? Walk me through the algorithm step by step.", difficulty: "Medium", keywords: ["O(log n)", "sorted array", "mid", "divide", "halve", "logarithmic", "compare"], hint: "Each step cuts the search space in half." },
    { text: "Explain dynamic programming. What is memoization and how does it differ from tabulation?", difficulty: "Hard", keywords: ["overlapping subproblems", "optimal substructure", "memoization", "tabulation", "top-down", "bottom-up", "cache", "recursion"], hint: "DP = break problem into overlapping pieces and store results." },
    { text: "What is a hash table? How does it handle collisions?", difficulty: "Medium", keywords: ["hash function", "key-value", "collision", "chaining", "open addressing", "linear probing", "O(1)", "bucket"], hint: "What happens when two keys map to the same bucket?" },
    { text: "Explain BFS vs DFS. What data structures do they use internally?", difficulty: "Medium", keywords: ["breadth first", "depth first", "queue", "stack", "level order", "recursion", "graph", "visited"], hint: "One explores layer by layer, the other goes as deep as possible first." },
    { text: "What is a balanced binary search tree? Why is balance important for performance?", difficulty: "Hard", keywords: ["AVL", "red-black", "height", "balanced", "O(log n)", "rotation", "skewed", "self-balancing"], hint: "Think about what happens to search time in a completely unbalanced tree." },
    { text: "Describe how merge sort works and what its time and space complexity is.", difficulty: "Medium", keywords: ["divide and conquer", "merge", "O(n log n)", "recursive", "split", "space", "stable", "auxiliary"], hint: "It splits the array in half recursively, then merges sorted halves." }
  ],
  HR: [
    { text: "Tell me about yourself and your journey into software development.", difficulty: "Easy", keywords: ["passion", "experience", "skills", "project", "learning", "growth", "contribution", "team"], hint: "Use Present-Past-Future: where you are, how you got here, where you're going." },
    { text: "Describe a time you faced a major technical challenge. How did you overcome it?", difficulty: "Medium", keywords: ["challenge", "solution", "research", "team", "outcome", "learned", "debugging", "collaborated", "result"], hint: "Use the STAR method: Situation, Task, Action, Result." },
    { text: "Where do you see yourself in five years, and how does this role align with that vision?", difficulty: "Easy", keywords: ["growth", "leadership", "skills", "contribute", "goal", "learn", "align", "vision", "career"], hint: "Show ambition while connecting your goals to what the company offers." },
    { text: "Tell me about a time you disagreed with a team member or manager. How did you handle it?", difficulty: "Hard", keywords: ["conflict", "communicate", "listen", "perspective", "compromise", "respect", "resolved", "outcome", "professional"], hint: "Show emotional intelligence — you can disagree professionally and still collaborate." },
    { text: "What is your greatest weakness, and what concrete steps are you taking to improve it?", difficulty: "Medium", keywords: ["honest", "aware", "improving", "steps", "learning", "growth", "feedback", "working on", "progress"], hint: "Be genuine — pick a real weakness you're actively working on. Avoid clichés." }
  ],
  ML: [
    { text: "Explain the bias-variance tradeoff in machine learning. How does it affect model selection?", difficulty: "Hard", keywords: ["bias", "variance", "overfitting", "underfitting", "tradeoff", "regularization", "complexity", "generalization"], hint: "High bias = too simple. High variance = memorized training data." },
    { text: "What is gradient descent? Explain the difference between batch, mini-batch, and stochastic gradient descent.", difficulty: "Hard", keywords: ["gradient", "learning rate", "convergence", "loss function", "epoch", "batch", "stochastic", "mini-batch", "update weights"], hint: "Think about how you update weights — using all data, one sample, or a subset." },
    { text: "What is the difference between supervised, unsupervised, and reinforcement learning? Give examples.", difficulty: "Medium", keywords: ["labeled", "unlabeled", "reward", "classification", "clustering", "agent", "policy", "regression", "k-means"], hint: "Think about the feedback signal — labels, structure, or reward." },
    { text: "Explain what a neural network is. What role do activation functions play?", difficulty: "Medium", keywords: ["neuron", "layer", "weights", "activation", "ReLU", "sigmoid", "backpropagation", "nonlinear", "deep learning"], hint: "Activation functions introduce non-linearity so the network can learn complex patterns." },
    { text: "What is overfitting? Name at least three techniques to prevent it.", difficulty: "Medium", keywords: ["overfitting", "regularization", "dropout", "L1", "L2", "cross-validation", "early stopping", "data augmentation", "generalize"], hint: "The model memorized training data instead of learning the underlying pattern." }
  ],
  Web: [
    { text: "Explain the difference between REST and GraphQL APIs. What are the advantages of each?", difficulty: "Medium", keywords: ["REST", "GraphQL", "endpoint", "query", "schema", "overfetching", "underfetching", "flexible", "HTTP"], hint: "REST has fixed endpoints. GraphQL lets the client ask for exactly what it needs." },
    { text: "What is the virtual DOM in React and why is it used?", difficulty: "Medium", keywords: ["virtual DOM", "reconciliation", "diffing", "performance", "re-render", "real DOM", "React", "component", "state"], hint: "Updating the real DOM is slow. React creates a lightweight copy to calculate minimal changes." },
    { text: "Explain CSS specificity. How does it determine which styles are applied?", difficulty: "Easy", keywords: ["specificity", "selector", "inline", "ID", "class", "element", "!important", "cascade", "weight", "priority"], hint: "Inline > ID > Class > Element. Each level has a numeric weight." },
    { text: "What is event bubbling and event capturing in JavaScript?", difficulty: "Medium", keywords: ["bubbling", "capturing", "propagation", "stopPropagation", "addEventListener", "DOM", "target", "event"], hint: "Events travel from target to root (bubbling) or root to target (capturing)." },
    { text: "What are Promises and async/await in JavaScript? How do they improve asynchronous code?", difficulty: "Medium", keywords: ["promise", "async", "await", "then", "catch", "asynchronous", "callback", "event loop", "non-blocking"], hint: "Promises represent a future value. async/await is syntactic sugar on top of them." }
  ],
  System: [
    { text: "How would you design a URL shortening service like bit.ly? Walk me through the architecture.", difficulty: "Hard", keywords: ["hash", "database", "redirect", "cache", "load balancer", "scalability", "unique", "collision", "key", "storage"], hint: "Think about read vs write ratio, URL uniqueness, and what happens at scale." },
    { text: "What is the CAP theorem? Explain its implications for distributed systems.", difficulty: "Hard", keywords: ["consistency", "availability", "partition tolerance", "distributed", "tradeoff", "network failure", "eventual consistency", "CAP"], hint: "You can only guarantee 2 out of 3 properties in a distributed system." },
    { text: "Explain horizontal vs vertical scaling. When would you choose one over the other?", difficulty: "Medium", keywords: ["horizontal", "vertical", "scale out", "scale up", "more servers", "bigger server", "load balancer", "distributed", "cost"], hint: "Vertical has a hardware ceiling. Horizontal can scale infinitely but adds complexity." },
    { text: "What is a CDN and why would you use one in a production web application?", difficulty: "Easy", keywords: ["content delivery network", "edge", "latency", "cache", "static", "geographically", "origin server", "performance"], hint: "CDNs serve content from servers closest to the user." },
    { text: "How would you design a notification system that handles millions of users reliably?", difficulty: "Hard", keywords: ["message queue", "Kafka", "push", "pull", "pub-sub", "scalable", "fanout", "database", "real-time", "priority"], hint: "Think about delivery guarantees, multiple channels, and queue-based architecture." }
  ]
};

const qState = { domain: "DSA", index: 0, count: 0 };

function getNextQuestion(domain) {
  const list = QUESTIONS[domain];
  const idx = Math.floor(Math.random() * list.length);
  qState.index = idx;
  qState.count++;
  return list[idx];
}
