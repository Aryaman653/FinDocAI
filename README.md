# 📊 Financial Document Intelligence

<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chart-dot-js&logoColor=white" alt="Chart.js" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
</div>

<p align="center">
  <strong>An AI-powered financial document analysis platform for intelligent transaction extraction and visualization.</strong>
</p>

![Dashboard Preview](https://via.placeholder.com/800x400?text=Financial+Dashboard+Preview)

## ✨ Features

- 📄 **Multi-Document Support**: Process various financial documents including:
  - Bank statements
  - Utility bills
  - Salary slips
  - Form 16 tax documents
  - Checks/Cheques
  
- 🤖 **AI-Powered Analysis**: Leverages Google's Gemini AI for intelligent document parsing and analysis

- 📊 **Advanced Visualizations**: Interactive charts and graphs for financial data:
  - Expense category distribution
  - Monthly income/expense trends
  - Transaction history

- 💰 **Financial Health Score**: Get a comprehensive score of your financial health with personalized recommendations

- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google Gemini API key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/financial-doc-intelligence.git
   cd financial-doc-intelligence
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory with the following variables:

   ```
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   DATABASE_URL=your_database_connection_string
   ```

4. **Set up the database**

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## 🧠 How It Works

1. **Upload Documents**: Upload your financial documents (PDF, JPG, PNG)
2. **OCR Processing**: The system extracts text using advanced OCR techniques
3. **AI Analysis**: Gemini AI analyzes the extracted text to identify transactions, categories, and financial patterns
4. **Visualization**: The processed data is visualized in an interactive dashboard
5. **Financial Score**: Get a financial health score and personalized recommendations

## 🛠️ Tech Stack

- **Frontend**: React, Next.js, TypeScript, Tailwind CSS
- **Visualization**: Chart.js, React-ChartJS-2
- **AI/ML**: Google Gemini AI
- **OCR**: Tesseract.js
- **Database**: PostgreSQL with Prisma ORM
- **Image Processing**: OpenCV.js

## 📁 Project Structure

```
financial-doc-intelligence/
├── prisma/                # Database schema and migrations
├── public/                # Static assets
├── src/
│   ├── components/        # Reusable UI components
│   ├── lib/               # Library code and utilities
│   ├── pages/             # Next.js pages
│   │   ├── api/           # API routes
│   │   ├── dashboard/     # Dashboard views
│   │   └── documents/     # Document management
│   ├── services/          # External service integrations
│   ├── styles/            # Global styles
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
│       ├── gemini.ts      # AI analysis utilities
│       └── ocr.ts         # OCR processing utilities
├── .env                   # Environment variables
├── next.config.js         # Next.js configuration
├── package.json           # Project dependencies
└── tsconfig.json          # TypeScript configuration
```

## 🔍 Key Components

### Document Processing

The application uses advanced OCR techniques to extract text from financial documents. The OCR process includes:

- Image preprocessing (deskewing, thresholding)
- Text extraction using Tesseract.js
- Financial data validation and pattern matching

### AI Analysis

The Gemini AI integration provides:

- Transaction identification and categorization
- Financial pattern recognition
- Personalized financial insights and recommendations

### Financial Dashboard

The interactive dashboard includes:

- Financial health score with visual indicators
- Expense category distribution (doughnut chart)
- Monthly income/expense trends (line chart)
- Transaction history with filtering and sorting

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Google Gemini AI](https://ai.google.dev/) for AI-powered document analysis
- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR capabilities
- [Chart.js](https://www.chartjs.org/) for data visualization
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
