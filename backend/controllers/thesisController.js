const thesisModel = require("../models/thesisModel");

const getTheses = async (req, res) => {
  try {
    const theses = await thesisModel.getAllTheses();
    res.json(theses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getThesis = async (req, res) => {
  try {
    const { id } = req.params;
    const thesis = await thesisModel.getThesisById(id);
    if (!thesis) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json(thesis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createThesis = async (req, res) => {
  try {
    const newThesis = await thesisModel.createThesis(req.body);
    res.status(201).json(newThesis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateThesis = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await thesisModel.updateThesis(id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteThesis = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await thesisModel.deleteThesis(id);
    if (!deleted) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json({ message: "Thesis deleted successfully", thesis: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTheses,
  getThesis,
  createThesis,
  updateThesis,
  deleteThesis,
};
