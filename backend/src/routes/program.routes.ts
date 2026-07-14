import { Router } from "express";
import { ProgramController } from "../controllers/program.controller";

const router = Router();
const programController = new ProgramController();

router.get('/', programController.getAllPrograms);

export default router;