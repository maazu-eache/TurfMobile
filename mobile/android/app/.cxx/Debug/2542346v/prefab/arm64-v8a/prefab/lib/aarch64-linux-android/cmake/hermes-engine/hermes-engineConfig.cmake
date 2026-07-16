if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/Users/apple/.gradle/caches/9.3.1/transforms/d315321a553ae87ed468c4d313cfc4bb/transformed/jetified-hermes-android-250829098.0.14-debug/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/.gradle/caches/9.3.1/transforms/d315321a553ae87ed468c4d313cfc4bb/transformed/jetified-hermes-android-250829098.0.14-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

