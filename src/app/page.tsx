import Link from "next/link";
import Image from "next/image";
import {
  Zap,
  Menu,
  UserPlus,
  PlayCircle,
  Check,
  Rocket,
  Handshake,
  Heart,
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="bg-white text-gray-800 font-sans overflow-x-hidden">

      {/* 1. NAVBAR (Sticky & Glass) */}
      <nav className="fixed w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-meteorite-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-meteorite-500 to-meteorite-700 flex items-center justify-center shadow-lg text-white mr-3">
                <Zap className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-meteorite-950">
                IISE UNSA
              </span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8 items-center">
              <Link href="#inicio" className="text-gray-600 hover:text-meteorite-600 font-medium transition-colors">
                Inicio
              </Link>
              <Link href="#nosotros" className="text-gray-600 hover:text-meteorite-600 font-medium transition-colors">
                Nosotros
              </Link>
              <Link href="#eventos" className="text-gray-600 hover:text-meteorite-600 font-medium transition-colors">
                Actividades
              </Link>
              <Link href="#beneficios" className="text-gray-600 hover:text-meteorite-600 font-medium transition-colors">
                Beneficios
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link
                href="/login"
                className="text-meteorite-600 font-bold hover:text-meteorite-800 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-full bg-meteorite-600 text-white font-bold shadow-lg shadow-meteorite-500/30 hover:bg-meteorite-700 hover:scale-105 transition-all"
              >
                Únete Ahora
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button className="text-meteorite-900 focus:outline-none">
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section
        id="inicio"
        className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-meteorite-50"
      >
        {/* Background Blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-meteorite-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-meteorite-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob [animation-delay:2000ms]"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-meteorite-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob [animation-delay:4000ms]"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center lg:text-left grid lg:grid-cols-2 gap-12 items-center">
          {/* Hero Text */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-meteorite-100 text-meteorite-700 text-xs font-bold mb-6 border border-meteorite-200">
              <span className="w-2 h-2 rounded-full bg-meteorite-500 mr-2 animate-pulse"></span>
              Convocatoria 2025 Abierta
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-meteorite-950 leading-tight mb-6">
              Liderazgo que <br />
              <span className="bg-gradient-to-br from-meteorite-600 to-meteorite-800 bg-clip-text text-transparent">
                Transforma el Futuro
              </span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0">
              Somos el capítulo estudiantil que impulsa el desarrollo
              profesional de los ingenieros industriales de la UNSA. Potencia
              tus habilidades, lidera proyectos y reduce la brecha laboral.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/login"
                className="px-8 py-4 rounded-xl bg-meteorite-600 text-white font-bold shadow-xl shadow-meteorite-600/20 hover:bg-meteorite-700 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" /> Ser Voluntario
              </Link>
              <Link
                href="#"
                className="px-8 py-4 rounded-xl bg-white text-meteorite-700 border border-meteorite-200 font-bold hover:bg-meteorite-50 transition-all flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-5 h-5" /> Ver Video
              </Link>
            </div>

            {/* Social Proof */}
            <div className="mt-10 flex items-center justify-center lg:justify-start space-x-4">
              <div className="flex -space-x-3">
                <img
                  className="w-10 h-10 rounded-full border-2 border-white"
                  src="https://i.pravatar.cc/100?img=1"
                  alt=""
                />
                <img
                  className="w-10 h-10 rounded-full border-2 border-white"
                  src="https://i.pravatar.cc/100?img=2"
                  alt=""
                />
                <img
                  className="w-10 h-10 rounded-full border-2 border-white"
                  src="https://i.pravatar.cc/100?img=3"
                  alt=""
                />
                <div className="w-10 h-10 rounded-full border-2 border-white bg-meteorite-100 flex items-center justify-center text-xs font-bold text-meteorite-600">
                  +80
                </div>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                Estudiantes activos
              </p>
            </div>
          </div>

          {/* Hero Image */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-meteorite-900/20 animate-float bg-gray-200 aspect-[4/3]">
              {/* Placeholder Image */}
              <Image
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80"
                alt="Estudiantes UNSA"
                fill
                className="object-cover"
                priority
              />

              {/* Floating Badge */}
              <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg border border-white/50 max-w-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">
                      Proyectos
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      30+ Ejecutados con éxito
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -z-10 -right-10 -bottom-10 text-meteorite-200">
              <svg
                width="200"
                height="200"
                viewBox="0 0 200 200"
                fill="currentColor"
              >
                <pattern
                  id="dots"
                  x="0"
                  y="0"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="2" cy="2" r="2"></circle>
                </pattern>
                <rect width="200" height="200" fill="url(#dots)"></rect>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ABOUT & STATS */}
      <section id="nosotros" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-meteorite-950 mb-4">
              Más que un voluntariado
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Somos una familia comprometida con la excelencia. En IISE UNSA
              cerramos la brecha entre la teoría académica y la práctica
              profesional.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            {/* Stat 1 */}
            <div className="p-8 rounded-3xl bg-meteorite-50 hover:bg-meteorite-100 transition-colors group">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center text-3xl text-meteorite-600 shadow-md mb-6 group-hover:scale-110 transition-transform">
                <Rocket className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Desarrollo Profesional
              </h3>
              <p className="text-sm text-gray-500">
                Talleres y capacitaciones alineados al perfil del egresado
                industrial.
              </p>
            </div>
            {/* Stat 2 */}
            <div className="p-8 rounded-3xl bg-meteorite-50 hover:bg-meteorite-100 transition-colors group">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center text-3xl text-meteorite-600 shadow-md mb-6 group-hover:scale-110 transition-transform">
                <Handshake className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Networking
              </h3>
              <p className="text-sm text-gray-500">
                Conecta con estudiantes y profesionales de todo el Perú y el
                mundo.
              </p>
            </div>
            {/* Stat 3 */}
            <div className="p-8 rounded-3xl bg-meteorite-50 hover:bg-meteorite-100 transition-colors group">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center text-3xl text-meteorite-600 shadow-md mb-6 group-hover:scale-110 transition-transform">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Impacto Social
              </h3>
              <p className="text-sm text-gray-500">
                Campañas de ayuda social, reciclaje y apoyo a la comunidad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ACTIVITIES (CARDS) */}
      <section
        id="eventos"
        className="py-20 bg-meteorite-950 text-white relative overflow-hidden"
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(#8a65ed 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div>
              <span className="text-meteorite-400 font-bold uppercase tracking-wider text-sm">
                Nuestras Iniciativas
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold mt-2">
                Actividades Principales
              </h2>
            </div>
            <Link
              href="#"
              className="hidden md:inline-flex items-center text-meteorite-300 hover:text-white transition-colors mt-4 md:mt-0 gap-2"
            >
              Ver calendario completo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-meteorite-900/50 backdrop-blur border border-meteorite-700 rounded-3xl overflow-hidden hover:transform hover:-translate-y-2 transition-all duration-300 group">
              <div className="h-48 bg-gray-800 relative">
                <Image
                  src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80"
                  alt="CEIISE"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-meteorite-600 text-xs font-bold px-3 py-1 rounded-full text-white">
                  Anual
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Congreso CEIISE</h3>
                <p className="text-meteorite-200 text-sm mb-4">
                  El evento académico más grande de ingeniería industrial,
                  reuniendo ponentes internacionales.
                </p>
                <Link
                  href="#"
                  className="text-sm font-bold text-meteorite-400 group-hover:text-white transition-colors"
                >
                  Más información &rarr;
                </Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-meteorite-900/50 backdrop-blur border border-meteorite-700 rounded-3xl overflow-hidden hover:transform hover:-translate-y-2 transition-all duration-300 group">
              <div className="h-48 bg-gray-800 relative">
                <Image
                  src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1632&q=80"
                  alt="Feria de Emprendimiento"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-orange-500 text-xs font-bold px-3 py-1 rounded-full text-white">
                  Negocios
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">
                  Feria de Emprendimiento
                </h3>
                <p className="text-meteorite-200 text-sm mb-4">
                  Más de 30 proyectos estudiantiles compitiendo por capital
                  semilla y mentoría.
                </p>
                <Link
                  href="#"
                  className="text-sm font-bold text-meteorite-400 group-hover:text-white transition-colors"
                >
                  Ver proyectos &rarr;
                </Link>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-meteorite-900/50 backdrop-blur border border-meteorite-700 rounded-3xl overflow-hidden hover:transform hover:-translate-y-2 transition-all duration-300 group">
              <div className="h-48 bg-gray-800 relative">
                <Image
                  src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80"
                  alt="Bienvenida Cachimbo"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-green-500 text-xs font-bold px-3 py-1 rounded-full text-white">
                  Integración
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">Bienvenida &quot;Cachimbo&quot;</h3>
                <p className="text-meteorite-200 text-sm mb-4">
                  Manuales de supervivencia, mentorías y actividades para los
                  nuevos ingresos.
                </p>
                <Link
                  href="#"
                  className="text-sm font-bold text-meteorite-400 group-hover:text-white transition-colors"
                >
                  Descargar guía &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BENEFITS GRID */}
      <section id="beneficios" className="py-20 bg-meteorite-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text Content */}
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-meteorite-950 mb-6">
                ¿Por qué unirte a IISE UNSA?
              </h2>
              <p className="text-gray-600 mb-8">
                Formar parte del capítulo te da acceso a recursos exclusivos y
                una red de contactos que impulsará tu carrera antes de egresar.
              </p>

              <ul class="space-y-6">
                <li className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-meteorite-600 flex items-center justify-center text-white mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-bold text-gray-900">
                      Certificación Internacional
                    </h4>
                    <p className="text-sm text-gray-500">
                      Reconocimiento oficial por el Institute of Industrial and
                      Systems Engineers.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-meteorite-600 flex items-center justify-center text-white mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-bold text-gray-900">
                      Visitas Técnicas
                    </h4>
                    <p className="text-sm text-gray-500">
                      Acceso a plantas industriales líderes en Arequipa y el sur
                      del país.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-meteorite-600 flex items-center justify-center text-white mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-bold text-gray-900">Talleres Blandos</h4>
                    <p className="text-sm text-gray-500">
                      Oratoria, liderazgo, crochet y manejo de estrés.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Interactive/Visual Content */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-meteorite-300 to-meteorite-500 rounded-3xl transform rotate-3 scale-95 opacity-50 blur-lg"></div>
              <div className="relative bg-white p-8 rounded-3xl shadow-xl border border-meteorite-100">
                <div className="flex items-center space-x-4 mb-6">
                  <img
                    src="https://i.pravatar.cc/150?img=32"
                    className="w-16 h-16 rounded-full border-4 border-meteorite-50"
                    alt="Testimonio"
                  />
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      &quot;Una experiencia única&quot;
                    </p>
                    <p className="text-sm text-meteorite-600">
                      María G., Ex-Presidenta
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 italic">
                  &quot;Entrar a IISE me permitió liderar equipos de más de 50
                  personas antes de terminar la carrera. Las habilidades que
                  aprendí aquí son las que uso hoy en mi trabajo.&quot;
                </p>

                <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">
                    Redes Sociales
                  </span>
                  <div className="flex space-x-3 text-meteorite-400">
                    <div className="hover:text-meteorite-600 cursor-pointer">
                      <span className="sr-only">Tiktok</span>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a90.25,90.25,0,1,0,43.7,173l0,.42V79.75A228.43,228.43,0,0,0,171.1,10.63V111a140.6,140.6,0,0,1-17,49.77A144,144,0,0,1,448,209.91Z" /></svg>
                    </div>
                    <Instagram className="w-5 h-5 hover:text-meteorite-600 cursor-pointer" />
                    <Linkedin className="w-5 h-5 hover:text-meteorite-600 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CTA / FOOTER */}
      <footer className="bg-white border-t border-meteorite-100">
        {/* Pre-footer CTA */}
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-meteorite-950 mb-6">
            ¿Listo para marcar la diferencia?
          </h2>
          <p className="text-gray-600 mb-8">
            Únete a la comunidad de estudiantes líderes más grande de la UNSA.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-3 rounded-xl bg-meteorite-600 text-white font-bold hover:bg-meteorite-700 transition-colors"
            >
              Postular Ahora
            </Link>
            <Link
              href="#"
              className="px-8 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
            >
              Contáctanos
            </Link>
          </div>
        </div>

        {/* Main Footer */}
        <div className="bg-meteorite-950 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 rounded-lg bg-meteorite-500 flex items-center justify-center mr-2">
                  <Zap className="w-4 h-4" />
                </div>
                <span className="font-bold text-lg">IISE UNSA</span>
              </div>
              <p className="text-meteorite-300 text-sm">
                Universidad Nacional de San Agustín de Arequipa, Perú.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-2 text-sm text-meteorite-200">
                <li>
                  <Link href="#" className="hover:text-white">
                    Sobre Nosotros
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Congreso CEIISE
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Noticias
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Recursos</h4>
              <ul className="space-y-2 text-sm text-meteorite-200">
                <li>
                  <Link href="#" className="hover:text-white">
                    Manual del Cachimbo
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Galería de Fotos
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white">
                    Portal de Miembros
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Síguenos</h4>
              <div className="flex space-x-4">
                <a
                  href="https://www.facebook.com/iiseunsa"
                  target="_blank"
                  className="w-10 h-10 rounded-full bg-meteorite-900 flex items-center justify-center hover:bg-meteorite-600 transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://www.instagram.com/iise.unsa"
                  target="_blank"
                  className="w-10 h-10 rounded-full bg-meteorite-900 flex items-center justify-center hover:bg-meteorite-600 transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href="https://www.tiktok.com/@iise_unsa"
                  target="_blank"
                  className="w-10 h-10 rounded-full bg-meteorite-900 flex items-center justify-center hover:bg-meteorite-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a90.25,90.25,0,1,0,43.7,173l0,.42V79.75A228.43,228.43,0,0,0,171.1,10.63V111a140.6,140.6,0,0,1-17,49.77A144,144,0,0,1,448,209.91Z" /></svg>
                </a>
                <a
                  href="https://www.linkedin.com/company/iise-unsa-618"
                  target="_blank"
                  className="w-10 h-10 rounded-full bg-meteorite-900 flex items-center justify-center hover:bg-meteorite-600 transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-meteorite-900 text-center text-xs text-meteorite-400">
            &copy; 2025 IISE UNSA Chapter. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
