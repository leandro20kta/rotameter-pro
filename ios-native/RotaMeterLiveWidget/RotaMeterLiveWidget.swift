import ActivityKit
import SwiftUI
import WidgetKit

@main
struct RotaMeterLiveWidgets: WidgetBundle {
    var body: some Widget { RotaMeterTripActivity() }
}

struct RotaMeterTripActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TripActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "location.north.line.fill")
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 4) {
                    Text("RotaMeter PRO").font(.headline)
                    Text(context.state.status).font(.caption)
                }
                Spacer()
                Text(String(format: "%.2f km", context.state.meters / 1000))
                    .font(.headline).monospacedDigit()
            }
            .padding(16)
            .widgetURL(URL(string: "rotameter://trip"))
            .activityBackgroundTint(Color.black)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("RotaMeter", systemImage: "car.side").font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(String(format: "%.2f km", context.state.meters / 1000))
                        .font(.headline).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.status).font(.caption)
                }
            } compactLeading: {
                Image(systemName: "location.fill")
            } compactTrailing: {
                Text(String(format: "%.1f", context.state.meters / 1000)).font(.caption2)
            } minimal: {
                Image(systemName: "location.fill")
            }
        }
    }
}
