import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KanbanBoard } from "./components/KanbanBoard";

const queryClient = new QueryClient();

function App() {
  // Replace this with your actual Todoist API token
  const TODOIST_API_TOKEN = import.meta.env.VITE_TODOIST_API_TOKEN;

  if (!TODOIST_API_TOKEN) {
    return (
      <div className="flex justify-center items-center h-screen bg-red-50">
        <div className="text-red-600 text-center">
          <h1 className="text-2xl font-bold mb-4">Missing API Token</h1>
          <p>
            Please set your Todoist API token in the .env file as
            VITE_TODOIST_API_TOKEN
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <KanbanBoard apiToken={TODOIST_API_TOKEN} />
    </QueryClientProvider>
  );
}

export default App;
