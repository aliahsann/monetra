# AI Financial Co-Pilot 🤝💰

A comprehensive AI-powered financial management platform designed specifically for micro-businesses, freelancers, and solo entrepreneurs. Get real-time insights, automated transaction categorization, and intelligent financial recommendations to grow your business with confidence.

## ✨ Features

- **📊 Real-Time Dashboard**: Monitor revenue, expenses, and cash flow at a glance with beautiful visualizations
- **📁 Smart Transaction Management**: Automatically categorize and organize transactions from CSV uploads
- **💡 AI-Powered Insights**: Get intelligent recommendations and alerts about your financial health
- **💬 Conversational AI Assistant**: Chat with your financial data using natural language
- **⚠️ Smart Alerts**: Never miss important financial events with automated notifications
- **📱 Fully Responsive**: Works seamlessly across desktop, tablet, and mobile devices

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern UI framework with hooks
- **Vite** - Fast development build tool
- **Framer Motion** - Smooth animations and transitions
- **GSAP** - Advanced animation library
- **React Icons** - Comprehensive icon library
- **Lenis** - Smooth scrolling experience

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.9+** - Core backend language
- **Supabase** - PostgreSQL database and authentication
- **Google Gemini** - AI/LLM integration for insights and chat
- **OpenAI** - Additional AI capabilities

### Database
- **PostgreSQL** - Robust relational database via Supabase

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+
- Supabase account (for database)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/mushahidd/AI-Financial-Co-Pilot.git
cd AI-Financial-Co-Pilot
```

2. **Frontend Setup**
```bash
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

3. **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Backend runs on http://localhost:8000
```

4. **Environment Configuration**
Create a `.env` file in the backend directory:
```env
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## 📁 Project Structure

```
AI-Financial-Co-Pilot/
├── frontend/
│   ├── App.jsx                 # Main React application with all components
│   ├── main.jsx               # React entry point
│   ├── index.html             # HTML template
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js        # Vite configuration
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application and endpoints
│   │   ├── models.py         # Database models
│   │   ├── supabase_db.py   # Database operations
│   │   ├── llm.py           # AI/LLM integration
│   │   ├── csv_parse.py      # CSV processing logic
│   │   ├── periods.py       # Date period utilities
│   │   └── config.py       # Configuration settings
│   ├── requirements.txt      # Python dependencies
│   └── .env                # Environment variables
├── sample_transactions.csv   # Sample data for testing
└── README.md               # This file
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|-----------|-------------|
| POST | `/upload-transactions` | Upload CSV file and process transactions |
| GET | `/insights?period=this_month` | Get AI-powered financial insights |
| POST | `/chat` | Chat with AI assistant about your finances |
| POST | `/classify?limit=100` | Classify transactions automatically |

### API Examples

**Upload Transactions:**
```bash
curl -X POST "http://localhost:8000/upload-transactions" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@transactions.csv"
```

**Get Insights:**
```bash
curl -X GET "http://localhost:8000/insights?period=this_month"
```

**Chat with AI:**
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Where is my money going?", "history": []}'
```

## 🎯 How It Works

1. **Upload**: Simply upload your bank transactions as a CSV file
2. **Process**: Our AI automatically categorizes and analyzes your transactions
3. **Insights**: Get real-time insights about spending patterns, revenue trends, and financial health
4. **Chat**: Ask questions in plain English and get instant answers about your finances
5. **Monitor**: Track your financial health with our intuitive dashboard

## 📊 Database Schema

The application uses PostgreSQL with the following main tables:

- **transactions**: Stores all financial transactions
- **categories**: Transaction categories for classification
- **insights**: AI-generated financial insights
- **users**: User account information

## 🧪 Demo Mode

If the backend is unreachable, the frontend automatically switches to demo mode with mock data, ensuring the UI is always demonstrable.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/mushahidd/AI-Financial-Co-Pilot/issues) page
2. Create a new issue with detailed information
3. Join our community discussions

## 🌟 Acknowledgments

- Built with modern web technologies for optimal performance
- AI powered by Google Gemini and OpenAI
- Database and authentication by Supabase
- Inspired by the need for accessible financial tools for small businesses

---

**Built with ❤️ for micro-businesses and entrepreneurs worldwide**
