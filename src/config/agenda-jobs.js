import Agenda from "agenda";

const { MONGO_URL } = process.env;
const agenda = new Agenda({
  db: {
    address: MONGO_URL,
    collection: "jobs",
  },
  defaultConcurrency: 50,
  defaultLockLimit: 50,
  maxConcurrency: 200,
  defaultLockLifetime: 30 * 60000,
});

export default agenda;
