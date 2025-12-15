import { Zap, Video, Calendar, MapPin, MoreVertical, Edit, Trash2 } from "lucide-react";

type EventItem = {
    id: string;
    title: string;
    date: Date; // Drizzle handles dates as Date objects
    startTime: string | null;
    endTime: string | null;
    isVirtual: boolean | null;
    meetLink: string | null;
    status: string | null;
    targetArea: {
        id: string;
        name: string;
        code: string | null;
    } | null;
};

interface EventsListProps {
    events: EventItem[];
}

export default function EventsList({ events }: EventsListProps) {
    if (!events || events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border border-meteorite-200/50 text-center">
                <div className="w-16 h-16 bg-meteorite-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-meteorite-500" />
                </div>
                <h3 className="text-xl font-bold text-meteorite-900 mb-2">Sin eventos programados</h3>
                <p className="text-meteorite-500 max-w-md">
                    No hay eventos próximos en tu agenda. ¡Crea uno nuevo para comenzar!
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
                const isGeneral = !event.targetArea;
                const dateObj = new Date(event.date);
                const day = dateObj.toLocaleDateString('es-ES', { day: '2-digit' });
                const month = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();

                return (
                    <div
                        key={event.id}
                        className="group relative bg-white/70 backdrop-blur-lg border border-meteorite-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-meteorite-900/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                    >
                        {/* Decorative Gradient Line */}
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${isGeneral ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-meteorite-500 to-meteorite-700'}`}></div>

                        <div className="flex items-start justify-between mb-4">
                            {/* Date Badge */}
                            <div className="flex flex-col items-center justify-center w-14 h-14 bg-meteorite-50 rounded-2xl border border-meteorite-100 group-hover:bg-meteorite-100 transition-colors">
                                <span className="text-xs font-bold text-meteorite-400 uppercase tracking-wider">{month}</span>
                                <span className="text-xl font-black text-meteorite-800 leading-none">{day}</span>
                            </div>

                            {/* Options Button (Visual only for now) */}
                            <button className="text-meteorite-300 hover:text-meteorite-600 transition-colors p-1">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Title & Area */}
                        <div className="mb-4">
                            <div className="flex items-center mb-2">
                                {isGeneral ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                                        GENERAL
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-meteorite-100 text-meteorite-700 border border-meteorite-200">
                                        {event.targetArea?.name}
                                    </span>
                                )}
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 leading-tight group-hover:text-meteorite-700 transition-colors">
                                {event.title}
                            </h3>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 text-sm text-gray-500 mb-5">
                            <div className="flex items-center">
                                <div className="w-5 flex justify-center mr-2"><Calendar className="w-4 h-4 text-meteorite-400" /></div>
                                <span>
                                    {event.startTime} - {event.endTime}
                                </span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-5 flex justify-center mr-2">
                                    {event.isVirtual ? <Video className="w-4 h-4 text-meteorite-400" /> : <MapPin className="w-4 h-4 text-meteorite-400" />}
                                </div>
                                <span className="truncate">
                                    {event.isVirtual ? "Virtual (Google Meet)" : "Presencial"}
                                </span>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-meteorite-100/50">
                            <div className="flex space-x-2">
                                <button className="p-2 rounded-lg text-gray-400 hover:bg-meteorite-50 hover:text-meteorite-600 transition-colors" title="Editar">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {event.isVirtual && event.meetLink && (
                                <a
                                    href={event.meetLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center px-3 py-2 bg-meteorite-600 text-white text-xs font-bold rounded-xl hover:bg-meteorite-700 hover:shadow-lg hover:shadow-meteorite-600/30 transition-all"
                                >
                                    <Video className="w-3 h-3 mr-2" />
                                    Unirse
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
