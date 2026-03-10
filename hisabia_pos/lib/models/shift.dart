class Shift {
  final String id;
  final double initialCash;
  final DateTime openedAt;

  Shift({
    required this.id,
    required this.initialCash,
    required this.openedAt,
  });

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: json['id'] as String,
      initialCash: (json['initial_cash'] as num?)?.toDouble() ?? 0,
      openedAt: DateTime.parse(json['opened_at'] as String),
    );
  }
}
