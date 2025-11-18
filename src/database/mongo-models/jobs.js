import mongoose from "mongoose";

const Jobs = new mongoose.Schema({}, { strict: false });

export default mongoose.model("jobs", Jobs, "jobs");
