require("dotenv").config();
const app = require("./src/app");
const { startJobs } = require("./src/services/jobs.service");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 BookLibrary API rodando na porta ${PORT}`);
    console.log(`📚 Ambiente: ${process.env.NODE_ENV || "development"}`);

    // Iniciar background jobs (não rodar em testes)
    if (process.env.NODE_ENV !== "test") {
        startJobs();
    }
});
