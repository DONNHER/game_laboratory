import { createMazeRunnerServer } from "../backend/server.js";

const server = await createMazeRunnerServer({ serveFrontend: false });

export default server;
