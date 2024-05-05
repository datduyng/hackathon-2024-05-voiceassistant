install_milvus:
        # https://milvus.io/docs/install_standalone-docker.md
        wget https://raw.githubusercontent.com/milvus-io/milvus/master/scripts/standalone_embed.sh


run_milvus:
        echo "Run Milvus..."
        echo "Make sure you have installed docker  and run it first"
        bash standalone_embed.sh start