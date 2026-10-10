const db = require("../db");

const users = [
  { id: "u1", username: "mark_antipo", full_name: "Mark Antipo", course: "BSIT", year_level: "3rd Year", bio: "Full stack developer & capstone project lead." },
  { id: "u2", username: "juan_delacruz", full_name: "Juan dela Cruz", course: "BSCS", year_level: "3rd Year", bio: "Frontend developer & web portal enthusiast." },
  { id: "u3", username: "angela_reyes", full_name: "Angela Reyes", course: "BSIS", year_level: "4th Year", bio: "Academic researcher specializing in AI and education." },
  { id: "u4", username: "carlo_mendoza", full_name: "Carlo Mendoza", course: "BSIT", year_level: "3rd Year", bio: "Mobile application developer using React Native and Expo." },
  { id: "u5", username: "trisha_v", full_name: "Trisha Villanueva", course: "BSCS", year_level: "4th Year", bio: "UI/UX designer and web developer." },
  { id: "u6", username: "rafael_b", full_name: "Rafael Buenaventura", course: "BSIS", year_level: "2nd Year", bio: "Blockchain and smart contract researcher." }
];

const posts = [
  {
    author_id: "u1",
    title: "LCC-Connect - Academic Portfolio Network",
    content: "A full platform for LCCB students to showcase projects, theses, and capstones. Features project feed, messaging, and academic repository.",
    type: "capstone",
    technologies: ["web", "react", "expo", "fullstack"],
    github_url: "https://github.com/lccb/lccb-connect"
  },
  {
    author_id: "u2",
    title: "Barangay Poblacion Digital Portal",
    content: "A full web portal for Barangay Poblacion allowing residents to request certificates and documents online. Built with Next.js and Tailwind CSS.",
    type: "project",
    technologies: ["nextjs", "tailwind", "web"],
    github_url: "https://github.com/barangay/portal"
  },
  {
    author_id: "u4",
    title: "Cardly - Campus Events Mobile App",
    content: "A mobile-first app for browsing, RSVPing, and getting reminders for LCCB campus events. Features a live campus map and digital card invitations.",
    type: "project",
    technologies: ["expo", "react-native", "maps"],
    github_url: "https://github.com/carlo/cardly"
  },
  {
    author_id: "u5",
    title: "Personal UI/UX Portfolio 2026",
    content: "My personal design portfolio showcasing UI/UX mobile wireframes, branding kits, and front-end design experiments created in Figma.",
    type: "image",
    technologies: ["portfolio", "ux", "figma"],
    github_url: "https://trisha-portfolio.com"
  }
];

const theses = [
  {
    uploader_id: "u3",
    title: "Impact of AI Tools on Student Learning Outcomes",
    abstract: "A quantitative research study analyzing how generative AI tools like ChatGPT and GitHub Copilot affect programming competence and critical thinking among undergraduate students.",
    department: "College of Computer Studies",
    category: "Undergraduate Capstone",
    pdf_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  },
  {
    uploader_id: "u6",
    title: "Blockchain-Based Academic Credential Verification System",
    abstract: "Proposes a decentralized architecture for verifying academic transcripts, diplomas, and certifications using distributed ledgers to prevent counterfeit documentation.",
    department: "College of Computer Studies",
    category: "Undergraduate Capstone",
    pdf_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  }
];

async function seed() {
  try {
    console.log("Seeding real users into Supabase PostgreSQL...");

    for (const u of users) {
      await db.query(`
        INSERT INTO profiles (id, username, full_name, course, year_level, bio)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE 
        SET username = EXCLUDED.username,
            full_name = EXCLUDED.full_name,
            course = EXCLUDED.course,
            year_level = EXCLUDED.year_level,
            bio = EXCLUDED.bio;
      `, [u.id, u.username, u.full_name, u.course, u.year_level, u.bio]);
    }
    console.log("Seeded 6 real student profiles.");

    for (const p of posts) {
      await db.query(`
        INSERT INTO posts (author_id, title, content, type, technologies, github_url)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [p.author_id, p.title, p.content, p.type, p.technologies, p.github_url]);
    }
    console.log("Seeded real student projects & posts.");

    for (const t of theses) {
      await db.query(`
        INSERT INTO theses (uploader_id, title, abstract, department, category, pdf_url)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [t.uploader_id, t.title, t.abstract, t.department, t.category, t.pdf_url]);
    }
    console.log("Seeded real academic theses & capstones.");

    console.log("SEEDING COMPLETE: All data is live in Supabase PostgreSQL!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
