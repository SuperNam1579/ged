import Link from "next/link";
import { BookOpen, TrendingUp, Zap, CheckCircle, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">GED Prep</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Adaptive Learning
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Ace Your GED with{" "}
            <span className="text-blue-600">AI-Powered</span> Study Plans
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-2xl mx-auto">
            Our platform uses genetic algorithms to build a personalized study schedule that adapts to your strengths and weaknesses — so you focus on what matters most.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Start for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-blue-600">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { value: "57", label: "Topics Covered" },
            { value: "4", label: "GED Subjects" },
            { value: "AI", label: "Optimized Schedule" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-extrabold text-white">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-blue-200">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Everything you need to pass your GED
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            Built specifically to help you pass faster by eliminating wasted study time.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                color: "bg-blue-100 text-blue-600",
                title: "Personalized Plans",
                description:
                  "Our genetic algorithm engine creates a study schedule optimized specifically for you — based on your knowledge gaps, available time, and target exam date.",
              },
              {
                icon: TrendingUp,
                color: "bg-green-100 text-green-600",
                title: "Adaptive Learning",
                description:
                  "Your plan automatically evolves as you take quizzes. Struggling with a topic? The system allocates more time to it and adjusts your upcoming schedule.",
              },
              {
                icon: CheckCircle,
                color: "bg-orange-100 text-orange-600",
                title: "Track Progress",
                description:
                  "Visual progress tracking across all 4 GED subjects with proficiency scores, predicted GED scores, and a clear view of your weakest areas.",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${feature.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How it works
          </h2>
          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Complete a quick assessment",
                description:
                  "Answer 40 diagnostic questions across all 4 GED subjects to map out your current knowledge level.",
              },
              {
                step: "02",
                title: "AI generates your study plan",
                description:
                  "Our genetic algorithm analyzes your results and builds an optimal study schedule — prioritizing your weak areas while respecting your available time.",
              },
              {
                step: "03",
                title: "Study, quiz, adapt",
                description:
                  "Follow your daily sessions. After each quiz, your plan automatically adapts. Keep going until you are ready for exam day.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to start your GED journey?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of learners who passed their GED with AI-powered study plans.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-blue-600 bg-white rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-white">GED Prep</span>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} GED Prep. Adaptive learning powered by genetic algorithms.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/login" className="hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-white transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
