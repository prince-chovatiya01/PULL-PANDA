// // SWE_project_website/client/src/pages/Login.tsx
// export default function Login() {
//   const handleLogin = () => {
//     window.location.href = "http://localhost:5000/api/auth/github";
//   };

//   return (
//     <div className="flex flex-col items-center justify-center h-screen">
//       <h1 className="text-3xl font-bold mb-6">Sign in with GitHub</h1>
//       <button
//         className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800"
//         onClick={handleLogin}
//       >
//         Login with GitHub
//       </button>
//     </div>
//   );
// }


// SWE_project_website/client/src/pages/Login.tsx
import logo from "./logo.jpg";

export default function Login() {
  const API_URL = import.meta.env.VITE_API_URL;

  const handleLogin = () => {
    // Redirect user to Railway server's GitHub OAuth route
    window.location.href = `${API_URL}/api/auth/github`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-black overflow-hidden">
      {/* Subtle animated background gradient */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-800 rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
        <div
          className="absolute top-1/3 right-1/4 w-96 h-96 bg-gray-700 rounded-full mix-blend-overlay filter blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-gray-800 rounded-full mix-blend-overlay filter blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-12 transform hover:scale-105 transition-transform duration-300">
          <div className="bg-white rounded-3xl p-2 shadow-2xl shadow-gray-800">
            <img src={logo} alt="PR Review Agent Logo" className="w-24 h-24" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold mb-3 text-white text-center tracking-tight">
          PR Review Agent
        </h1>
        <p className="text-gray-400 text-lg mb-12 text-center max-w-md">
          Sign in with your GitHub account to continue
        </p>

        {/* Login button */}
        <button
          className="group relative px-8 py-3 bg-white text-black rounded-lg font-medium text-base shadow-lg hover:bg-gray-200 transition-all duration-200 overflow-hidden"
          onClick={handleLogin}
        >
          <span className="relative flex items-center gap-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 
                  0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463
                  -.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338
                  -2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647
                  0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 
                  2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 
                  0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 
                  0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 
                  16.418 22 12c0-5.523-4.477-10-10-10z"
                clipRule="evenodd"
              />
            </svg>
            Continue with GitHub
          </span>
        </button>
      </div>
    </div>
  );
}
